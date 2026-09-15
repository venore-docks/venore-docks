import { beforeEach, describe, expect, it, vi } from "vitest";

const countEntriesByAuthor = vi.fn();

vi.mock("./store", () => ({
  countEntriesByAuthor: (...args: unknown[]) => countEntriesByAuthor(...args),
}));

describe("countEntriesByAuthor", () => {
  beforeEach(() => {
    countEntriesByAuthor.mockReset();
  });

  it("returns the count from the store", async () => {
    countEntriesByAuthor.mockResolvedValue(3);

    const { countEntriesByAuthor: service } = await import("./service");
    const result = await service({ authorId: "user-1" });

    expect(countEntriesByAuthor).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ success: true, data: 3 });
  });
});
