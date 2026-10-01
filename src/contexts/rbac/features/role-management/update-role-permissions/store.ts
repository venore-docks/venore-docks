import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { roles, rolePermissions, userRoles } from "../../../database/schema";

export async function findRoleById(roleId: string) {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return role ?? null;
}

export async function findUserIdsWithRole(roleId: string): Promise<string[]> {
  const rows = await db.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, roleId));
  return rows.map((row) => row.userId);
}

export async function findRolePermissionKeys(roleId: string): Promise<string[]> {
  const rows = await db
    .select({ permissionKey: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((row) => row.permissionKey);
}

export async function replaceRolePermissions(roleId: string, permissionKeys: string[]) {
  return db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    if (permissionKeys.length > 0) {
      await tx.insert(rolePermissions).values(
        permissionKeys.map((permissionKey) => ({ roleId, permissionKey })),
      );
    }

    const [role] = await tx
      .update(roles)
      .set({ updatedAt: new Date() })
      .where(eq(roles.id, roleId))
      .returning();

    return role;
  });
}
