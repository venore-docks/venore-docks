// Fluxo cruzado auth + rbac + settings: o que acontece com uma conta recém-cadastrada conforme a
// setting de aprovação (platform/registration/handle-user-registered.ts). Services reais; só o
// insert em auth.users é cru (não há API pública pra criar usuário sem sessão).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { users } from "@/contexts/auth/database/schema";
import { ensureBaseRbacDataSeeded, listUserIdsWithPermission } from "@/contexts/rbac";
import { seedUserWithSystemRole } from "@/test-support/integration/rbac-seed";
import { getUserContext } from "@/contexts/rbac/features/role-assignment/get-user-context/service";
import { setSetting } from "@/contexts/settings/features/set-setting/service";
import { handleUserRegistered, REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY } from "@/platform/registration/handle-user-registered";

async function registerUser(): Promise<string> {
  const email = `${randomUUID()}@integration.test`;
  // Sem `status`: vale o default do schema — é justamente o que o teste confere (fail-closed).
  const [row] = await db.insert(users).values({ email, name: "Visitante" }).returning({ id: users.id });
  const result = await handleUserRegistered({ id: row.id, email, name: "Visitante" });
  expect(result.success).toBe(true);
  return row.id;
}

async function statusOf(userId: string): Promise<string> {
  const [row] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId));
  return row.status;
}

describe("registration flow (auth + rbac + settings)", () => {
  beforeEach(async () => {
    await ensureBaseRbacDataSeeded();
  });

  it("keeps the account pending and without roles while approval is required", async () => {
    await setSetting({ key: REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY, value: true, actorId: "system" });

    const userId = await registerUser();

    expect(await statusOf(userId)).toBe("pending");
    const context = await getUserContext({ userId });
    expect(context.success && context.data.roles).toEqual([]);
  });

  it("activates the account with the default role, never superadmin, when approval is off", async () => {
    await setSetting({ key: REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY, value: false, actorId: "system" });

    const userId = await registerUser();

    expect(await statusOf(userId)).toBe("approved");
    const context = await getUserContext({ userId });
    expect(context.success).toBe(true);
    if (!context.success) return;
    expect(context.data.roles.length).toBeGreaterThan(0);
    expect(context.data.isSuperadmin).toBe(false);
  });

  it("finds who can approve registrations (admin by permission, superadmin always), but not members", async () => {
    const admin = await seedUserWithSystemRole("admin");
    const member = await seedUserWithSystemRole("member");

    const approvers = await listUserIdsWithPermission("rbac.users.manage");

    expect(approvers).toContain(admin.userId);
    expect(approvers).not.toContain(member.userId);
  });
});
