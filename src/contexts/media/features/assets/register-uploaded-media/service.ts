import { storagePort } from "@/infrastructure/storage";
import { beginOperation, endOperation } from "@/observability";
import { resolveAssetUrl } from "../../../asset-url";
import { attachAssetVariantsToOne } from "../../../shared/attach-asset-variants";
import { generateAssetVariants } from "../generate-asset-variants/service";
import { CONTENT_MISMATCH_ERROR, SNIFF_BYTES, contentMatchesDeclaredType } from "../../../content-sniffing";
import { assertTypeAllowedForDirectUpload, validateMediaUploadCandidate } from "../request-media-upload-ticket/service";
import { findActiveAssetByChecksum, findAssetByPathname, insertAssetIfAbsent } from "./store";
import type { RegisterUploadedMediaCommand, RegisterUploadedMediaResult } from "./types";

async function readHead(pathname: string, size: number): Promise<Uint8Array | null> {
  if (size === 0) return new Uint8Array(0);
  const object = await storagePort.read(pathname, { start: 0, end: Math.min(size, SNIFF_BYTES) - 1 });
  if (!object) return null;
  return new Uint8Array(await new Response(object.body).arrayBuffer());
}

// Ponto único de criação de linha em media.assets (blob-spec seção 4/9). Chamado tanto pela
// confirmação feita pelo browser (sempre acontece, em dev e produção) quanto pelo webhook
// onUploadCompleted (só existe em produção) — os dois caminhos convergem aqui, e a idempotência
// por `pathname` garante que a segunda chamada nunca cria um segundo registro.
export async function registerUploadedMedia(command: RegisterUploadedMediaCommand): Promise<RegisterUploadedMediaResult> {
  const handle = beginOperation({
    useCase: "media.register-uploaded-media",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existingByPathname = await findAssetByPathname(command.pathname);
  if (existingByPathname) {
    endOperation(handle, { success: true });
    return { success: true, data: existingByPathname };
  }

  // O objeto precisa existir DE VERDADE no storage, e tamanho/tipo vêm dele — não do que o
  // cliente declarou (antes dava pra registrar qualquer URL externa como "mídia", que o export
  // depois baixava no servidor).
  const stored = await storagePort.stat(command.pathname);
  if (!stored) {
    const error = { code: "media.register.object_not_found", message: "O arquivo enviado não foi encontrado no storage." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  const typeCheck = validateMediaUploadCandidate({ contentType: stored.contentType, size: stored.size });
  if (!typeCheck.success) {
    endOperation(handle, typeCheck);
    return typeCheck;
  }
  const directCheck = assertTypeAllowedForDirectUpload(stored.contentType);
  if (!directCheck.success) {
    endOperation(handle, directCheck);
    return directCheck;
  }

  // Tipo do storage é só o que o cliente declarou no upload direto — confere pelos primeiros bytes.
  const head = await readHead(command.pathname, stored.size);
  if (!head || !contentMatchesDeclaredType(stored.contentType, head)) {
    const mismatch = { success: false as const, error: { ...CONTENT_MISMATCH_ERROR } };
    endOperation(handle, mismatch);
    return mismatch;
  }

  // Checksum batendo com um asset soft-deletado não é reaproveitado — trataria como upload
  // novo, para não ressuscitar silenciosamente algo removido de propósito (blob-spec seção 8).
  // Só com checksum calculado no servidor (ver checksumVerified em types.ts).
  if (command.checksumVerified) {
    const existingByChecksum = await findActiveAssetByChecksum(command.checksum);
    if (existingByChecksum) {
      endOperation(handle, { success: true });
      return { success: true, data: existingByChecksum };
    }
  }

  const id = crypto.randomUUID();
  const visibility = command.visibility ?? "private";
  const inserted = await insertAssetIfAbsent({
    id,
    filename: command.filename,
    pathname: command.pathname,
    url: resolveAssetUrl({ id, pathname: command.pathname, visibility }),
    contentType: stored.contentType,
    size: stored.size,
    checksum: command.checksum,
    width: command.width ?? null,
    height: command.height ?? null,
    alt: command.alt ?? null,
    visibility,
    uploadedBy: command.actorId,
  });

  if (inserted) {
    // Upload direto: os bytes nunca passaram pelo servidor, então a geração lê o original do
    // storage uma vez. Só aqui (linha recém-criada) — as chamadas repetidas (webhook depois da
    // confirmação) saem cedo acima, sem gerar de novo. Falha não derruba o registro.
    await generateAssetVariants({ assetId: inserted.id });
    endOperation(handle, { success: true });
    return { success: true, data: (await attachAssetVariantsToOne(inserted)) ?? inserted };
  }

  // Corrida: outra chamada concorrente inseriu entre o select e o insert. onConflictDoNothing
  // não retornou linha — busca de novo, a linha tem que existir agora.
  const raced = await findAssetByPathname(command.pathname);
  if (!raced) {
    const error = { code: "media.register.race_failed", message: `Não foi possível registrar o asset "${command.pathname}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  endOperation(handle, { success: true });
  return { success: true, data: raced };
}
