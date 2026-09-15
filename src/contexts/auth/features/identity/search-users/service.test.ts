import { beforeEach, describe, expect, it, vi } from "vitest";

const findUsers = vi.fn();

vi.mock("./store", () => ({
  findUsers: (...args: unknown[]) => findUsers(...args),
}));

describe("searchUsers", () => {
  beforeEach(() => {
    findUsers.mockReset();
  });

  it("delegates the query to the store and wraps the result", async () => {
    const data = {
      entries: [{ id: "user-1", name: "A", email: "a@b.com", status: "approved", createdAt: new Date(), lastLoginAt: null }],
      hasMore: false,
    };
    findUsers.mockResolvedValue(data);

    const { searchUsers } = await import("./service");
    const result = await searchUsers({ search: "a@b.com", status: "approved" });

    expect(findUsers).toHaveBeenCalledWith({ search: "a@b.com", status: "approved" });
    expect(result).toEqual({ success: true, data });
  });
});
