// Helpers de seed de RBAC para os testes de integração (*.integration.test.ts). Fora de
// src/contexts/* de propósito (mesmo racional de academy-seed.ts): precisa inserir em auth.users
// direto (não há API pública pra criar usuário) e chamar service.ts internos. O resto passa pelos
// services reais para exercitar o código de produção.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "@/contexts/auth/database/schema";
import { roles } from "@/contexts/rbac/database/schema";
import { ensureBaseRbacDataSeeded } from "@/contexts/rbac";
import { assignRoleToUser } from "@/contexts/rbac/features/role-assignment/assign-role-to-user/service";
import { assignScopeToRoleAssignment } from "@/contexts/rbac/features/role-assignment/assign-scope-to-role-assignment/service";
import { grantSuperadmin } from "@/contexts/rbac/features/role-assignment/grant-superadmin/service";

const CMS_CATEGORY_SCOPE_TYPE = "cms.category";

export async function seedRbacUser(overrides: Partial<{ email: string; name: string }> = {}): Promise<{ id: string }> {
  const [row] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `${randomUUID()}@integration.test`,
      name: overrides.name ?? "RBAC Integration User",
      status: "approved",
    })
    .returning({ id: users.id });
  return row;
}

export async function findSystemRoleId(key: string): Promise<string> {
  const [row] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key)).limit(1);
  if (!row) {
    throw new Error(`Papel de sistema "${key}" não semeado — chame ensureBaseRbacDataSeeded() antes.`);
  }
  return row.id;
}

// Ator das atribuições semeadas: um superadmin de teste. Antes o próprio usuário se atribuía o
// papel — exatamente a auto-concessão que a trava anti-escalonamento (rbac/shared/
// privilege-guard.ts) agora recusa.
async function seedSuperadminActor(): Promise<string> {
  const actor = await seedRbacUser({ name: "RBAC Seed Superadmin" });
  const granted = await grantSuperadmin({ userId: actor.id });
  if (!granted.success) {
    throw new Error(`seedSuperadminActor: ${granted.error.code} — ${granted.error.message}`);
  }
  return actor.id;
}

// Cria um usuário, dá o papel de sistema `roleKey` e (opcional) escopa a atribuição às
// `categoryIds` via os services reais (que invalidam o cache do contexto do usuário).
export async function seedUserWithSystemRole(
  roleKey: string,
  options: { categoryIds?: string[] } = {},
): Promise<{ userId: string; roleId: string }> {
  await ensureBaseRbacDataSeeded();

  const user = await seedRbacUser();
  const roleId = await findSystemRoleId(roleKey);

  const actorId = await seedSuperadminActor();
  const assigned = await assignRoleToUser({ userId: user.id, roleId, actor: { id: actorId } });
  if (!assigned.success) {
    throw new Error(`seedUserWithSystemRole: ${assigned.error.code} — ${assigned.error.message}`);
  }

  for (const resourceId of options.categoryIds ?? []) {
    const scoped = await assignScopeToRoleAssignment({
      userId: user.id,
      roleId,
      scopeType: CMS_CATEGORY_SCOPE_TYPE,
      resourceId,
      actor: { id: actorId },
    });
    if (!scoped.success) {
      throw new Error(`seedUserWithSystemRole (scope): ${scoped.error.code} — ${scoped.error.message}`);
    }
  }

  return { userId: user.id, roleId };
}
