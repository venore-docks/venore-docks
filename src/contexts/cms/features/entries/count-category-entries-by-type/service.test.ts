import { beforeEach, describe, expect, it, vi } from "vitest";

const findCategoryTypeCounts = vi.fn();
vi.mock("./store", () => ({ findCategoryTypeCounts: (...args: unknown[]) => findCategoryTypeCounts(...args) }));

import { invalidateCacheByPrefix } from "../../../../../infrastructure/cache/memory-cache";
import { countCategoryEntriesByType } from "./service";

describe("countCategoryEntriesByType", () => {
  beforeEach(() => {
    findCategoryTypeCounts.mockReset();
    invalidateCacheByPrefix("cms:entries:published:type-counts:");
  });

  it("devolve as contagens do store e cacheia por categoria + visibilidade", async () => {
    findCategoryTypeCounts.mockResolvedValue([{ contentTypeId: "t1", key: "campanhas", name: "Campanhas", count: 4 }]);
    const first = await countCategoryEntriesByType({ categoryId: "c1", visibility: "public" });
    const second = await countCategoryEntriesByType({ categoryId: "c1", visibility: "public" });
    expect(first).toEqual({ success: true, data: [{ contentTypeId: "t1", key: "campanhas", name: "Campanhas", count: 4 }] });
    expect(second).toEqual(first);
    expect(findCategoryTypeCounts).toHaveBeenCalledTimes(1);
  });

  it("não mistura o cache de visitante (public) com o de quem tem sessão", async () => {
    findCategoryTypeCounts.mockResolvedValue([]);
    await countCategoryEntriesByType({ categoryId: "c1", visibility: "public" });
    await countCategoryEntriesByType({ categoryId: "c1" });
    expect(findCategoryTypeCounts).toHaveBeenCalledTimes(2);
  });
});
