import { beginOperation, endOperation } from "@/observability";
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

  // Checksum batendo com um asset soft-deletado não é reaproveitado — trataria como upload
  // novo, para não ressuscitar silenciosamente algo removido de propósito (blob-spec seção 8).
  const existingByChecksum = await findActiveAssetByChecksum(command.checksum);
  if (existingByChecksum) {
    endOperation(handle, { success: true });
    return { success: true, data: existingByChecksum };
  }

  const inserted = await insertAssetIfAbsent({
    filename: command.filename,
    pathname: command.pathname,
    url: command.url,
    contentType: command.contentType,
    size: command.size,
    checksum: command.checksum,
    width: command.width ?? null,
    height: command.height ?? null,
    alt: command.alt ?? null,
    visibility: command.visibility ?? "private",
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
