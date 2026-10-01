import { beginOperation, endOperation } from "@/observability";
import { invalidateUserContext } from "../../../user-context-cache";
import { deleteRoleAssignmentScope } from "./store";
import type { RemoveScopeFromRoleAssignmentCommand, RemoveScopeFromRoleAssignmentResult } from "./types";

// Simétrico de assign-scope-to-role-assignment. Idempotente: apagar uma linha inexistente é
// sucesso (deixa a atribuição global — a mesma semântica D2 de "sem linha = global"). Não valida
// scopeType nem a existência da atribuição de propósito: limpeza sempre pode rodar, inclusive
// depois do papel já ter saído do usuário. Invalida o cache do contexto do usuário afetado.
export async function removeScopeFromRoleAssignment(
  command: RemoveScopeFromRoleAssignmentCommand,
): Promise<RemoveScopeFromRoleAssignmentResult> {
  const handle = beginOperation({
    useCase: "rbac.role-assignment.remove-scope-from-role-assignment",
    actor: { id: command.actor.id, type: "user" },
    kind: "write",
  });

  await deleteRoleAssignmentScope(command.userId, command.roleId, command.scopeType, command.resourceId);
  await invalidateUserContext(command.userId);

  endOperation(handle, { success: true });

  return { success: true, data: undefined };
}
