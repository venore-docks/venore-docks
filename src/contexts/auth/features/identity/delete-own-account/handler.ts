import { getUserContext } from "@/contexts/rbac";
import { getCurrentUserService } from "../../session/get-current-user/service";
import { deleteOwnAccount } from "./service";
import type { DeleteOwnAccountInput, DeleteOwnAccountResult } from "./types";

export async function deleteOwnAccountHandler(input: DeleteOwnAccountInput): Promise<DeleteOwnAccountResult> {
  const current = await getCurrentUserService();
  if (!current.success || !current.data) {
    return { success: false, error: { code: "auth.unauthenticated", message: "É necessário estar autenticado." } };
  }
  // Superadmin não se apaga sozinho: outra pessoa superadmin faz isso (evita instância sem dono).
  const context = await getUserContext({ userId: current.data.id });
  if (context.success && context.data.isSuperadmin) {
    return {
      success: false,
      error: { code: "auth.identity.superadmin_self_delete", message: "Superadmin não pode excluir a própria conta. Peça a outro superadmin." },
    };
  }
  return deleteOwnAccount(current.data.id, input);
}
