import { updateSession } from "../../../auth.config";
import { signSessionVersion } from "./session-version-proof";
import { findSessionVersion } from "./store";

// Depois de invalidar as sessões da própria conta (sair dos outros dispositivos, trocar a senha),
// renova o token DESTA sessão com a versão nova — assinada, pra o callback jwt aceitar.
// Só funciona dentro de Server Action/Route Handler (grava cookie).
export async function renewCurrentSession(userId: string): Promise<void> {
  const sessionVersion = await findSessionVersion(userId);
  if (sessionVersion === null) return;
  await updateSession({ svProof: signSessionVersion(userId, sessionVersion) } as Record<string, unknown>);
}
