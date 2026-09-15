import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserService = vi.fn();
vi.mock("../../session/get-current-user/service", () => ({
  getCurrentUserService: (...args: unknown[]) => getCurrentUserService(...args),
}));

const setOwnName = vi.fn();
vi.mock("./service", () => ({
  setOwnName: (...args: unknown[]) => setOwnName(...args),
}));

describe("setOwnNameHandler", () => {
  beforeEach(() => {
    getCurrentUserService.mockReset();
    setOwnName.mockReset();
  });

  it("rejects when there is no authenticated user", async () => {
    getCurrentUserService.mockResolvedValue({ success: true, data: null });

    const { setOwnNameHandler } = await import("./handler");
    const result = await setOwnNameHandler({ name: "Ana" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.unauthenticated", message: expect.any(String) },
    });
    expect(setOwnName).not.toHaveBeenCalled();
  });

  it("rejects a session authenticated via an OAuth provider", async () => {
    getCurrentUserService.mockResolvedValue({ success: true, data: { id: "user-1", authProvider: "google" } });

    const { setOwnNameHandler } = await import("./handler");
    const result = await setOwnNameHandler({ name: "Ana" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.name_managed_by_provider", message: expect.any(String) },
    });
    expect(setOwnName).not.toHaveBeenCalled();
  });

  it("rejects a session with no known auth provider (fail-closed)", async () => {
    getCurrentUserService.mockResolvedValue({ success: true, data: { id: "user-1", authProvider: null } });

    const { setOwnNameHandler } = await import("./handler");
    const result = await setOwnNameHandler({ name: "Ana" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.name_managed_by_provider", message: expect.any(String) },
    });
    expect(setOwnName).not.toHaveBeenCalled();
  });

  it("resolves the actor from the session and delegates to the service for a credentials session", async () => {
    getCurrentUserService.mockResolvedValue({ success: true, data: { id: "user-1", authProvider: "credentials" } });
    setOwnName.mockResolvedValue({ success: true, data: { id: "user-1" } });

    const { setOwnNameHandler } = await import("./handler");
    const result = await setOwnNameHandler({ name: "Ana" });

    expect(setOwnName).toHaveBeenCalledWith({ actorId: "user-1", name: "Ana" });
    expect(result).toEqual({ success: true, data: { id: "user-1" } });
  });
});
