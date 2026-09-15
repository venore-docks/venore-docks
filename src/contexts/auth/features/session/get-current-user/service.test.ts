import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findAvatarMediaId = vi.fn();

vi.mock("./store", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
  findAvatarMediaId: (...args: unknown[]) => findAvatarMediaId(...args),
}));

describe("getCurrentUserService", () => {
  beforeEach(() => {
    getSession.mockReset();
    findAvatarMediaId.mockReset();
  });

  it("returns null when there is no active session", async () => {
    getSession.mockResolvedValue(null);

    const { getCurrentUserService } = await import("./service");
    expect(await getCurrentUserService()).toEqual({ success: true, data: null });
  });

  it("refuses a pending session — treated as unauthenticated (P9)", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", email: "u@e.com", status: "pending" } });

    const { getCurrentUserService } = await import("./service");
    const result = await getCurrentUserService();

    expect(result).toEqual({ success: true, data: null });
    expect(findAvatarMediaId).not.toHaveBeenCalled();
  });

  it.each(["rejected", "frozen", "removed"] as const)(
    "refuses a %s session — treated as unauthenticated (P9 generalizado)",
    async (status) => {
      getSession.mockResolvedValue({ user: { id: "u1", email: "u@e.com", status } });

      const { getCurrentUserService } = await import("./service");
      const result = await getCurrentUserService();

      expect(result).toEqual({ success: true, data: null });
      expect(findAvatarMediaId).not.toHaveBeenCalled();
    },
  );

  it("returns the authenticated user for an approved session", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", email: "u@e.com", name: "U", image: null, status: "approved", provider: "credentials" },
    });
    findAvatarMediaId.mockResolvedValue("media-1");

    const { getCurrentUserService } = await import("./service");
    const result = await getCurrentUserService();

    expect(result).toEqual({
      success: true,
      data: { id: "u1", email: "u@e.com", name: "U", image: null, avatarMediaId: "media-1", authProvider: "credentials" },
    });
  });

  it("falls back authProvider to null for a session created before this field existed", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", email: "u@e.com", name: "U", image: null, status: "approved" },
    });
    findAvatarMediaId.mockResolvedValue(null);

    const { getCurrentUserService } = await import("./service");
    const result = await getCurrentUserService();

    expect(result).toEqual({
      success: true,
      data: { id: "u1", email: "u@e.com", name: "U", image: null, avatarMediaId: null, authProvider: null },
    });
  });
});
