import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/contexts/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

const getUserContext = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
}));

describe("resolveMediaActorScope", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getUserContext.mockReset();
  });

  it("returns null when there is no session", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: null });

    const { resolveMediaActorScope } = await import("./resolve-media-actor-scope");
    const scope = await resolveMediaActorScope();

    expect(scope).toBeNull();
    expect(getUserContext).not.toHaveBeenCalled();
  });

  it("flags isMediaAdmin for an actor with the media.manage permission", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "actor-1" } });
    getUserContext.mockResolvedValue({ success: true, data: { isSuperadmin: false, permissions: ["media.manage"], roles: [] } });

    const { resolveMediaActorScope } = await import("./resolve-media-actor-scope");
    const scope = await resolveMediaActorScope();

    expect(scope).toMatchObject({ actorId: "actor-1", isMediaAdmin: true });
  });

  it("flags isMediaAdmin for a superadmin even without the explicit permission listed", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "actor-1" } });
    getUserContext.mockResolvedValue({ success: true, data: { isSuperadmin: true, permissions: [], roles: [] } });

    const { resolveMediaActorScope } = await import("./resolve-media-actor-scope");
    const scope = await resolveMediaActorScope();

    expect(scope).toMatchObject({ actorId: "actor-1", isMediaAdmin: true });
  });

  it("resolves a plain authenticated actor as not a media admin", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "actor-2" } });
    getUserContext.mockResolvedValue({ success: true, data: { isSuperadmin: false, permissions: [], roles: [] } });

    const { resolveMediaActorScope } = await import("./resolve-media-actor-scope");
    const scope = await resolveMediaActorScope();

    expect(scope).toMatchObject({ actorId: "actor-2", isMediaAdmin: false, isSuperadmin: false });
  });
});
