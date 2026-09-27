import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { rolePermissions, roles, userRoles } from "../../../database/schema";
import { SUPERADMIN_ROLE_KEY } from "../../../shared/privilege-guard";

export async function countDistinctUsersWithPermissions(permissionKeys: string[]): Promise<number> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(inArray(rolePermissions.permissionKey, permissionKeys));

  return rows.length;
}

// Quem tem a permission por algum papel, mais todo superadmin (acesso irrestrito sem linha em
// role_permissions). Uso de sistema (avisos), sem gate.
export async function findUserIdsWithPermission(permissionKey: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(or(eq(roles.key, SUPERADMIN_ROLE_KEY), eq(rolePermissions.permissionKey, permissionKey)));
  return rows.map((row) => row.userId);
}
