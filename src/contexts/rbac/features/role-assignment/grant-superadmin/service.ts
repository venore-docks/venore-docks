import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { ensureBaseRbacDataSeeded } from "../../../ensure-base-rbac-data";
import { invalidateUserContext } from "../../../user-context-cache";
import { insertUserRole } from "../assign-role-to-user/store";
import { findRoleIdByKey } from "../assign-default-role/store";
import type { GrantSuperadminInput, GrantSuperadminResult } from "./types";

export async function grantSuperadmin(command: GrantSuperadminInput): Promise<GrantSuperadminResult> {
  const handle = beginOperation({
    useCase: "rbac.role-assignment.grant-superadmin",
    actor: { id: command.userId, type: "system" },
    kind: "write",
  });

  await ensureBaseRbacDataSeeded();
  const roleId = await findRoleIdByKey("superadmin");
  if (!roleId) {
    const error = {
      code: "rbac.roles.superadmin_role_missing",
      message: 'Papel "superadmin" não encontrado — confirme que as migrations do core foram aplicadas.',
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  await insertUserRole(command.userId, roleId);
  await invalidateUserContext(command.userId);
  endOperation(handle, {
    success: true,
    summary: `Usuário ${command.userId} recebeu o papel superadmin.`,
  });

  // Concessão de superadmin é a ação mais privilegiada do sistema — sempre auditada,
  // independente de quem chamou (bootstrap ou fluxo futuro), ver audit-log.ts.
  await recordAuditEvent({
    action: "rbac.grant-superadmin",
    actor: { id: command.userId, type: "system" },
    outcome: "success",
    summary: `Usuário ${command.userId} recebeu o papel superadmin.`,
    detail: { userId: command.userId, roleId },
  });

  return { success: true, data: undefined };
}
