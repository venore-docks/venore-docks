import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "admin-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const rejectUserRegistration = vi.fn();
vi.mock("@/contexts/auth", () => ({
  rejectUserRegistration: (...args: unknown[]) => rejectUserRegistration(...args),
}));

describe("rejectRegistration", () => {
  beforeEach(() => {
    recordAuditEvent.mockReset();
    rejectUserRegistration.mockReset();
  });

  it("fails without auditing when the user was not pending", async () => {
    const error = { code: "auth.registrations.not_pending", message: "não pendente" };
    rejectUserRegistration.mockResolvedValue({ success: false, error });

    const { rejectRegistration } = await import("./service");
    const result = await rejectRegistration({ userId: "user-1", actor: { id: "admin-1" } });

    expect(result).toEqual({ success: false, error });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects the registration and audits", async () => {
    rejectUserRegistration.mockResolvedValue({ success: true, data: undefined });

    const { rejectRegistration } = await import("./service");
    const result = await rejectRegistration({ userId: "user-1", reason: "spam", actor: { id: "admin-1" } });

    expect(rejectUserRegistration).toHaveBeenCalledWith({ userId: "user-1" });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rbac.reject-registration",
        detail: { targetUserId: "user-1", reason: "spam" },
      }),
    );
    expect(result).toEqual({ success: true, data: undefined });
  });
});
