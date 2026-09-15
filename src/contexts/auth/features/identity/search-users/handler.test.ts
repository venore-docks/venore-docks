import { beforeEach, describe, expect, it, vi } from "vitest";

const searchUsers = vi.fn();

vi.mock("./service", () => ({
  searchUsers: (...args: unknown[]) => searchUsers(...args),
}));

describe("searchUsersHandler", () => {
  beforeEach(() => {
    searchUsers.mockReset();
  });

  it("delegates to the service with an empty query by default", async () => {
    searchUsers.mockResolvedValue({ success: true, data: { entries: [], hasMore: false } });

    const { searchUsersHandler } = await import("./handler");
    const result = await searchUsersHandler();

    expect(searchUsers).toHaveBeenCalledWith({});
    expect(result).toEqual({ success: true, data: { entries: [], hasMore: false } });
  });

  it("forwards the query as-is", async () => {
    searchUsers.mockResolvedValue({ success: true, data: { entries: [], hasMore: false } });

    const { searchUsersHandler } = await import("./handler");
    await searchUsersHandler({ search: "a", status: "frozen", cursor: "u1" });

    expect(searchUsers).toHaveBeenCalledWith({ search: "a", status: "frozen", cursor: "u1" });
  });
});
