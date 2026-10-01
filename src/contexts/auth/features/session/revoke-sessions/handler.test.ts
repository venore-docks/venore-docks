import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActorOverUser = vi.fn();
vi.mock("@/contexts/rbac", () => ({ authorizeActorOverUser: (...args: unknown[]) => authorizeActorOverUser(...args) }));
const getCurrentUserHandler = vi.fn();
vi.mock("../get-current-user/handler", () => ({ getCurrentUserHandler: () => getCurrentUserHandler() }));
vi.mock("./renew-current-session", () => ({ renewCurrentSession: async () => undefined }));
const revokeSessions = vi.fn(async () => ({ success: true, data: { sessionVersion: 1 } }));
vi.mock("./service", () => ({ revokeSessions: (...args: unknown[]) => revokeSessions(...(args as [])) }));

describe("revoke-sessions handlers", () => {
  beforeEach(() => {
    authorizeActorOverUser.mockReset();
    getCurrentUserHandler.mockReset();
    revokeSessions.mockClear();
  });

  it("own sessions require being logged in", async () => {
    getCurrentUserHandler.mockResolvedValue({ success: true, data: null });
    const { revokeOwnSessionsHandler } = await import("./handler");
    expect((await revokeOwnSessionsHandler()).success).toBe(false);
    expect(revokeSessions).not.toHaveBeenCalled();
  });

  it("someone else's sessions go through the user hierarchy check", async () => {
    authorizeActorOverUser.mockResolvedValue({ authorized: false, error: { code: "rbac.authorization.target_outranks_actor", message: "no" } });
    const { revokeUserSessionsHandler } = await import("./handler");
    expect((await revokeUserSessionsHandler({ targetUserId: "boss" })).success).toBe(false);
    expect(authorizeActorOverUser).toHaveBeenCalledWith("rbac.users.manage", "boss");
    expect(revokeSessions).not.toHaveBeenCalled();
  });
});
