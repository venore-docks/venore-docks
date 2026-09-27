import { beginOperation, endOperation } from "@/observability";
import { markUserApproved } from "./store";
import type { ActivateUserCommand, ActivateUserResult } from "./types";

// Libera uma conta recém-criada (status -> "approved") por decisão do SISTEMA, não de um ator:
// cadastro com aprovação desligada, ou bootstrap do primeiro superadmin. Não concede papel —
// composição auth + rbac mora em platform/registration (regra 12).
export async function activateUser(command: ActivateUserCommand): Promise<ActivateUserResult> {
  const handle = beginOperation({
    useCase: "auth.identity.activate-user",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  const updated = await markUserApproved(command.userId);
  if (!updated) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.userId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  endOperation(handle, { success: true, summary: `Conta ${command.userId} liberada (${command.reason}).` });
  return { success: true, data: undefined };
}
