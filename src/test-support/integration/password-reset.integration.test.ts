// Recuperação de senha ponta a ponta no banco: pedido -> link no e-mail -> nova senha, uso único e
// sessões antigas derrubadas. O provedor de e-mail é substituído por um coletor.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const outbox: { to: string; text: string }[] = [];
vi.mock("@/infrastructure/email", () => ({
  emailPort: {
    isEnabled: () => true,
    send: async (message: { to: string; text: string }) => {
      outbox.push(message);
      return { sent: true, id: null };
    },
  },
}));

import { db } from "@/infrastructure/database/client";
import { users } from "@/contexts/auth/database/schema";
import { requestPasswordReset } from "@/contexts/auth/features/identity/request-password-reset/service";
import { resetPasswordWithToken } from "@/contexts/auth/features/identity/reset-password-with-token/service";
import { verifyPasswordHash } from "@/contexts/auth/features/identity/password-hashing";

describe("password reset (auth + e-mail)", () => {
  it("sends a single-use link that sets the new password and ends old sessions", async () => {
    const email = `${randomUUID()}@integration.test`;
    const [user] = await db.insert(users).values({ email, status: "approved" }).returning({ id: users.id });

    await requestPasswordReset({ email: email.toUpperCase(), resetUrl: "https://site.test/reset-password" });
    const message = outbox.find((item) => item.to === email);
    expect(message).toBeDefined();
    const token = decodeURIComponent(message!.text.match(/token=(\S+)/)![1]);

    expect(await resetPasswordWithToken({ token, newPassword: "senha-nova-123" })).toEqual({ success: true, data: { userId: user.id } });
    const [row] = await db.select({ hash: users.passwordHash, version: users.sessionVersion }).from(users).where(eq(users.id, user.id));
    expect(await verifyPasswordHash("senha-nova-123", row.hash!)).toBe(true);
    expect(row.version).toBe(1);

    // Mesmo link de novo: não vale mais.
    expect((await resetPasswordWithToken({ token, newPassword: "outra-senha-456" })).success).toBe(false);
  });

  it("sends nothing for a pending account", async () => {
    const email = `${randomUUID()}@integration.test`;
    await db.insert(users).values({ email });
    const before = outbox.length;
    expect((await requestPasswordReset({ email, resetUrl: "https://site.test/reset-password" })).success).toBe(true);
    expect(outbox.length).toBe(before);
  });
});
