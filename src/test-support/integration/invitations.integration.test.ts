// Convite ponta a ponta no banco (auth + rbac): o papel é atribuído em nome de quem convidou, com
// as mesmas travas de privilégio. A parte com sessão (authorizeActor) tem teste unitário próprio.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { users } from "@/contexts/auth/database/schema";
import { createInvitation, getInvitation } from "@/contexts/auth";
import { checkActorCanGrantRole } from "@/contexts/rbac";
import { getUserContext } from "@/contexts/rbac/features/role-assignment/get-user-context/service";
import { acceptInvitation } from "@/platform/registration/invitations";
import { findSystemRoleId, seedUserWithSystemRole } from "@/test-support/integration/rbac-seed";

describe("invitations (auth + rbac)", () => {
  it("creates an approved account with the invited role, once", async () => {
    const admin = await seedUserWithSystemRole("admin");
    const editorRoleId = await findSystemRoleId("editor");
    expect((await checkActorCanGrantRole(admin.userId, editorRoleId)).success).toBe(true);

    const email = `${randomUUID()}@integration.test`;
    const created = await createInvitation({ email, roleId: editorRoleId, invitedBy: admin.userId });
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect((await getInvitation(created.data.token)).success).toBe(true);

    const accepted = await acceptInvitation({ token: created.data.token, name: "Convidada", password: "senha-convite-1" });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;

    const [row] = await db.select({ status: users.status }).from(users).where(eq(users.id, accepted.data.userId));
    expect(row.status).toBe("approved");
    const context = await getUserContext({ userId: accepted.data.userId });
    expect(context.success && context.data.roles.map((role) => role.key)).toContain("editor");

    expect((await acceptInvitation({ token: created.data.token, name: "De novo", password: "senha-convite-2" })).success).toBe(false);
    expect((await createInvitation({ email, roleId: editorRoleId, invitedBy: admin.userId })).success).toBe(false);
  });

  it("an admin cannot invite someone as superadmin", async () => {
    const admin = await seedUserWithSystemRole("admin");
    const superadminRoleId = await findSystemRoleId("superadmin");
    expect((await checkActorCanGrantRole(admin.userId, superadminRoleId)).success).toBe(false);
  });
});
