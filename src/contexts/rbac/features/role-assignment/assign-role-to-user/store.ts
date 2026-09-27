import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { rolePermissions, roles, userRoles } from "../../../database/schema";

export async function findRoleWithPermissions(
  roleId: string,
): Promise<{ id: string; key: string; permissionKeys: string[] } | null> {
  const [role] = await db.select({ id: roles.id, key: roles.key }).from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) return null;
  const rows = await db
    .select({ permissionKey: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));
  return { ...role, permissionKeys: rows.map((row) => row.permissionKey) };
}

export async function insertUserRole(userId: string, roleId: string): Promise<void> {
  await db
    .insert(userRoles)
    .values({ userId, roleId })
    .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });
}
