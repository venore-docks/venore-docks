import { getCurrentUserService } from "../../session/get-current-user/service";
import { getOwnAccountData } from "./service";
import type { GetOwnAccountDataResult } from "./types";

// Autoatendimento: só a própria conta (nunca o hash da senha nem o segredo do 2FA).
export async function getOwnAccountDataHandler(): Promise<GetOwnAccountDataResult> {
  const current = await getCurrentUserService();
  if (!current.success || !current.data) {
    return { success: false, error: { code: "auth.unauthenticated", message: "É necessário estar autenticado." } };
  }
  return getOwnAccountData(current.data.id);
}
