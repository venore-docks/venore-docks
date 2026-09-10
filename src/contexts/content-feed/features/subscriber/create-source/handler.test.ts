import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const createSource = vi.fn();
vi.mock("./service", () => ({
  createSource: (...args: unknown[]) => createSource(...args),
}));

const validInput = { name: "Portal do Colaborador", remoteUrl: "https://portal.erasto.com.br", connectionKey: "abc123", categoryKeys: [] };

describe("createSourceHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    createSource.mockReset();
  });

  it("rejects an empty name without checking authorization", async () => {
    const { createSourceHandler } = await import("./handler");
    const result = await createSourceHandler({ ...validInput, name: "  " });

    expect(result).toEqual({
      success: false,
      error: { code: "content-feed.sources.invalid_name", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
  });

  it.each(["not-a-url", "ftp://portal.erasto.com.br", ""])("rejects an invalid remoteUrl (%s)", async (remoteUrl) => {
    const { createSourceHandler } = await import("./handler");
    const result = await createSourceHandler({ ...validInput, remoteUrl });

    expect(result).toEqual({
      success: false,
      error: { code: "content-feed.sources.invalid_remote_url", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
  });

  it("rejects an empty connectionKey", async () => {
    const { createSourceHandler } = await import("./handler");
    const result = await createSourceHandler({ ...validInput, connectionKey: "  " });

    expect(result).toEqual({
      success: false,
      error: { code: "content-feed.sources.invalid_connection_key", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
  });

  it("rejects an actor without content-feed.sources.manage", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { createSourceHandler } = await import("./handler");
    const result = await createSourceHandler(validInput);

    expect(authorizeActor).toHaveBeenCalledWith("content-feed.sources.manage");
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(createSource).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "actor-1" });
    createSource.mockResolvedValue({ success: true, data: { id: "source-1" } });

    const { createSourceHandler } = await import("./handler");
    const result = await createSourceHandler(validInput);

    expect(createSource).toHaveBeenCalledWith({ ...validInput, actorId: "actor-1" });
    expect(result).toEqual({ success: true, data: { id: "source-1" } });
  });
});
