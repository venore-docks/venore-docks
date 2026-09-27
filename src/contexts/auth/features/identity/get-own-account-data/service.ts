import { findOwnAccountData } from "./store";
import type { GetOwnAccountDataResult } from "./types";

export async function getOwnAccountData(userId: string): Promise<GetOwnAccountDataResult> {
  const data = await findOwnAccountData(userId);
  return data ? { success: true, data } : { success: false, error: { code: "auth.users.not_found", message: "Usuário não encontrado." } };
}
