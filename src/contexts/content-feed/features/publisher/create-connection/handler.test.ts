import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const createConnection = vi.fn();
vi.mock("./service", () => ({
  createConnection: (...args: unknown[]) => createConnection(...args),
}));

describe("createConnectionHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    createConnection.mockReset();
  });

  it("rejects an empty name without checking authorization", async () => {
    const { createConnectionHandler } = await import("./handler");
    const result = await createConnectionHandler({ name: "  ", categoryIds: [] });

    expect(result).toEqual({
      success: false,
      error: { code: "content-feed.connections.invalid_name", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
  });

  it("rejects an actor without content-feed.connections.manage", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { createConnectionHandler } = await import("./handler");
    const result = await createConnectionHandler({ name: "Broadcast FEM", categoryIds: [] });

    expect(authorizeActor).toHaveBeenCalledWith("content-feed.connections.manage");
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(createConnection).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "actor-1" });
    createConnection.mockResolvedValue({ success: true, data: { id: "conn-1" } });

    const { createConnectionHandler } = await import("./handler");
    const result = await createConnectionHandler({ name: "Broadcast FEM", categoryIds: ["cat-1"] });

    expect(createConnection).toHaveBeenCalledWith({ name: "Broadcast FEM", categoryIds: ["cat-1"], actorId: "actor-1" });
    expect(result).toEqual({ success: true, data: { id: "conn-1" } });
  });
});
