import { storagePort } from "@/infrastructure/storage";
import { beginOperation, endOperation } from "@/observability";
import { resolveAssetUrl } from "../../../asset-url";
import { assertTypeAllowedForDirectUpload, validateMediaUploadCandidate } from "../request-media-upload-ticket/service";
import { findActiveAssetByChecksum, findAssetByPathname, insertAssetIfAbsent } from "./store";
import type { RegisterUploadedMediaCommand, RegisterUploadedMediaResult } from "./types";

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
    endOperation(handle, { success: true });
    return { success: true, data: inserted };
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
