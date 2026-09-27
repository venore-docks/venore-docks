import { beginOperation, endOperation } from "@/observability";
import { isRbacScopeType } from "../../../contracts/scope-types";
import { invalidateUserContext } from "../../../user-context-cache";
import { insertRoleAssignmentScope, userRoleAssignmentExists } from "./store";
import type { AssignScopeToRoleAssignmentCommand, AssignScopeToRoleAssignmentResult } from "./types";

// Limita uma atribuição de papel EXISTENTE (userId × roleId) a um recurso — ADITIVO e idempotente
// (D1/D2 de docs/rbac-scoped-roles.md). Não cria a atribuição de papel: o papel tem que já estar
// no usuário. Invalida o cache do contexto do usuário afetado, igual assign-role-to-user faz.
export async function assignScopeToRoleAssignment(
  command: AssignScopeToRoleAssignmentCommand,
): Promise<AssignScopeToRoleAssignmentResult> {
  const handle = beginOperation({
    useCase: "rbac.role-assignment.assign-scope-to-role-assignment",
    actor: { id: command.actor.id, type: "user" },
    kind: "write",
  });

  if (!isRbacScopeType(command.scopeType)) {
    const error = {
      code: "rbac.scopes.invalid_type",
      message: `Tipo de escopo "${command.scopeType}" não é reconhecido.`,
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const assignmentExists = await userRoleAssignmentExists(command.userId, command.roleId);
  if (!assignmentExists) {
    const error = {
      code: "rbac.scopes.assignment_not_found",
      message: "O usuário não possui esse papel — atribua o papel antes de definir o escopo.",
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  await insertRoleAssignmentScope(command.userId, command.roleId, command.scopeType, command.resourceId);
  await invalidateUserContext(command.userId);

  endOperation(handle, { success: true });

  return { success: true, data: undefined };
}
