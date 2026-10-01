import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserService = vi.fn();
vi.mock("../../session/get-current-user/service", () => ({
  getCurrentUserService: (...args: unknown[]) => getCurrentUserService(...args),
}));

const renewCurrentSession = vi.fn(async () => undefined);
vi.mock("../../session/revoke-sessions/renew-current-session", () => ({
  renewCurrentSession: (...args: unknown[]) => renewCurrentSession(...(args as [])),
}));

const setOwnPassword = vi.fn();
vi.mock("./service", () => ({
  setOwnPassword: (...args: unknown[]) => setOwnPassword(...args),
}));

describe("setOwnPasswordHandler", () => {
  beforeEach(() => {
    getCurrentUserService.mockReset();
    setOwnPassword.mockReset();
  });

  it("rejects when there is no authenticated user", async () => {
    getCurrentUserService.mockResolvedValue({ success: true, data: null });

    const { setOwnPasswordHandler } = await import("./handler");
    const result = await setOwnPasswordHandler({ newPassword: "supersecret" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.unauthenticated", message: expect.any(String) },
    });
    expect(setOwnPassword).not.toHaveBeenCalled();
  });

  it("resolves the actor from the session and delegates to the service", async () => {
    getCurrentUserService.mockResolvedValue({ success: true, data: { id: "user-1" } });
    setOwnPassword.mockResolvedValue({ success: true, data: { id: "user-1" } });

    const { setOwnPasswordHandler } = await import("./handler");
    const result = await setOwnPasswordHandler({ newPassword: "supersecret" });

    expect(setOwnPassword).toHaveBeenCalledWith({ actorId: "user-1", newPassword: "supersecret", currentPassword: undefined });
    expect(result).toEqual({ success: true, data: { id: "user-1" } });
    expect(renewCurrentSession).toHaveBeenCalledWith("user-1");
  });
});
