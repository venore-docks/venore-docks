import { beforeEach, describe, expect, it, vi } from "vitest";

const listArticlesForConnection = vi.fn();
vi.mock("./service", () => ({
  listArticlesForConnection: (...args: unknown[]) => listArticlesForConnection(...args),
}));

describe("listArticlesForConnectionHandler", () => {
  beforeEach(() => {
    listArticlesForConnection.mockReset();
  });

  it("rejects an empty key without calling the service", async () => {
    const { listArticlesForConnectionHandler } = await import("./handler");
    const result = await listArticlesForConnectionHandler({ key: "  " });

    expect(result).toEqual({
      success: false,
      error: { code: "content-feed.connections.invalid_key", message: expect.any(String) },
    });
    expect(listArticlesForConnection).not.toHaveBeenCalled();
  });

  it("delegates to the service — no authorizeActor, this is key-based access", async () => {
    listArticlesForConnection.mockResolvedValue({ success: true, data: { articles: [] } });

    const { listArticlesForConnectionHandler } = await import("./handler");
    const result = await listArticlesForConnectionHandler({ key: "the-key" });

    expect(listArticlesForConnection).toHaveBeenCalledWith({ key: "the-key" });
    expect(result).toEqual({ success: true, data: { articles: [] } });
  });
});
