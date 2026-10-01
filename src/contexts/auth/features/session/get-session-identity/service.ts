import { getSession } from "../get-current-user/store";
import { findIdentityById } from "./store";
import type { GetSessionIdentityResult } from "./types";

// Quem é a sessão atual, QUALQUER que seja o status (inclusive "pending") — ao contrário de
// getCurrentUser, que só reconhece "approved". Existe só pra telas que precisam saber quem está
// do outro lado antes da aprovação (setup do primeiro superadmin). Nunca usar pra autorizar nada.
export async function getSessionIdentityService(): Promise<GetSessionIdentityResult> {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) return { success: true, data: null };

  const identity = await findIdentityById(id);
  if (!identity) return { success: true, data: null };
  return { success: true, data: { id, email: identity.email, status: identity.status } };
}
