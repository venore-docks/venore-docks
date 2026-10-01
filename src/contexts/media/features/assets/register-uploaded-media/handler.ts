import { authorizeActor } from "@/contexts/rbac";
import { registerUploadedMedia } from "./service";
import type { RegisterUploadedMediaCommand, RegisterUploadedMediaResult } from "./types";

export type ConfirmMediaUploadInput = Omit<RegisterUploadedMediaCommand, "actorId">;

// Diferente dos outros handlers do repo, este NÃO chama authorizeActor: `actorId` chega já
// resolvido por quem chama, porque este handler tem dois chamadores legítimos com formas
// diferentes de estabelecer confiança (blob-spec seção 9):
//   1. o webhook onUploadCompleted (rota) — actorId vem do tokenPayload assinado, embutido no
//      momento em que o ticket foi emitido (autorização já aconteceu lá).
//   2. a confirmação feita pelo browser (server action) — chama authorizeActor("media.manage")
//      ela mesma antes de invocar este handler.
// Repetir authorizeActor aqui seria autorizar duas vezes no caminho 2 e seria impossível no
// caminho 1 (webhook não tem sessão de usuário).
export async function registerUploadedMediaHandler(command: RegisterUploadedMediaCommand): Promise<RegisterUploadedMediaResult> {
  if (command.filename.trim().length === 0) {
    return { success: false, error: { code: "media.register.invalid_filename", message: "O nome do arquivo não pode ser vazio." } };
  }
  if (command.pathname.trim().length === 0) {
    return { success: false, error: { code: "media.register.invalid_pathname", message: "O pathname não pode ser vazio." } };
  }
  if (command.checksum.trim().length === 0) {
    return { success: false, error: { code: "media.register.invalid_checksum", message: "O checksum não pode ser vazio." } };
  }
  if (command.actorId.trim().length === 0) {
    return { success: false, error: { code: "media.register.invalid_actor", message: "actorId não pode ser vazio." } };
  }

  // Tipo/tamanho são revalidados no service contra o que o STORAGE reporta (storagePort.stat),
  // não contra o que o cliente declarou.
  return registerUploadedMedia(command);
}

// Entrada pública para confirmação feita pelo browser (blob-spec seção 9, passo 3): autentica +
// autoriza aqui mesmo, porque — diferente do webhook — este caminho é alcançável diretamente
// por um client sem token embutido. Só depois disso delega pro handler de baixo nível acima.
export async function confirmMediaUploadHandler(input: ConfirmMediaUploadInput): Promise<RegisterUploadedMediaResult> {
  const authz = await authorizeActor("media.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  // Confirmação vinda do browser: checksum não verificado (fica fora da deduplicação).
  return registerUploadedMediaHandler({ ...input, actorId: authz.actorId, checksumVerified: false });
}
