import { beforeEach, describe, expect, it, vi } from "vitest";

const countEntriesByAuthor = vi.fn();

vi.mock("./service", () => ({
  countEntriesByAuthor: (...args: unknown[]) => countEntriesByAuthor(...args),
}));

describe("countEntriesByAuthorHandler", () => {
  beforeEach(() => {
    countEntriesByAuthor.mockReset();
  });

  it("delegates to the service", async () => {
    countEntriesByAuthor.mockResolvedValue({ success: true, data: 0 });

    const { countEntriesByAuthorHandler } = await import("./handler");
    const result = await countEntriesByAuthorHandler({ authorId: "user-1" });

    expect(countEntriesByAuthor).toHaveBeenCalledWith({ authorId: "user-1" });
    expect(result).toEqual({ success: true, data: 0 });
  });
});
