import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCache = vi.fn();
vi.mock("../../../../../infrastructure/cache/memory-cache", () => ({
  invalidateCache: (...args: unknown[]) => invalidateCache(...args),
}));

const findContentTypeById = vi.fn();
const findExclusivelyTaggedEntryIds = vi.fn();
const removeContentType = vi.fn();

vi.mock("./store", () => ({
  findContentTypeById: (...args: unknown[]) => findContentTypeById(...args),
  findExclusivelyTaggedEntryIds: (...args: unknown[]) => findExclusivelyTaggedEntryIds(...args),
  removeContentType: (...args: unknown[]) => removeContentType(...args),
}));

function contentType(id: string) {
  return { id, key: id, name: id, description: null, createdAt: new Date(), updatedAt: new Date() };
}

describe("deleteContentType", () => {
  beforeEach(() => {
    findContentTypeById.mockReset().mockResolvedValue(contentType("tag-1"));
    findExclusivelyTaggedEntryIds.mockReset().mockResolvedValue([]);
    removeContentType.mockReset().mockResolvedValue(undefined);
    invalidateCache.mockReset();
  });

  it("rejects when the tag being deleted does not exist", async () => {
    findContentTypeById.mockResolvedValue(null);

    const { deleteContentType } = await import("./service");
    const result = await deleteContentType({ id: "missing", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.content-types.not_found", message: expect.any(String) },
    });
    expect(removeContentType).not.toHaveBeenCalled();
  });

  it("without a reassignment target, rejects deletion when it would leave entries with zero tags", async () => {
    findExclusivelyTaggedEntryIds.mockResolvedValue(["entry-1", "entry-2"]);

    const { deleteContentType } = await import("./service");
    const result = await deleteContentType({ id: "tag-1", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.content-types.would_orphan_entries", message: expect.any(String) },
    });
    expect(removeContentType).not.toHaveBeenCalled();
  });

  it("without a reassignment target, deletes when no entry would end up with zero tags", async () => {
    findExclusivelyTaggedEntryIds.mockResolvedValue([]);

    const { deleteContentType } = await import("./service");
    const result = await deleteContentType({ id: "tag-1", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(removeContentType).toHaveBeenCalledWith("tag-1", null);
    expect(invalidateCache).toHaveBeenCalledWith("cms:content-types");
  });

  it("rejects a reassignment target equal to the tag being deleted", async () => {
    const { deleteContentType } = await import("./service");
    const result = await deleteContentType({ id: "tag-1", reassignToId: "tag-1", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.content-types.invalid_reassignment", message: expect.any(String) },
    });
    expect(removeContentType).not.toHaveBeenCalled();
  });

  it("rejects a reassignment target that does not exist", async () => {
    findContentTypeById.mockImplementation(async (id: string) => (id === "tag-1" ? contentType("tag-1") : null));

    const { deleteContentType } = await import("./service");
    const result = await deleteContentType({ id: "tag-1", reassignToId: "missing", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.content-types.reassignment_target_not_found", message: expect.any(String) },
    });
    expect(removeContentType).not.toHaveBeenCalled();
  });

  it("with a valid reassignment target, deletes even when every entry was exclusively tagged", async () => {
    findContentTypeById.mockImplementation(async (id: string) => contentType(id));
    // Reatribuição não precisa checar findExclusivelyTaggedEntryIds — o destino garante que
    // nenhuma entry fica sem tag, então o service nem chama essa verificação.
    findExclusivelyTaggedEntryIds.mockResolvedValue(["entry-1"]);

    const { deleteContentType } = await import("./service");
    const result = await deleteContentType({ id: "tag-1", reassignToId: "tag-2", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(removeContentType).toHaveBeenCalledWith("tag-1", "tag-2");
    expect(findExclusivelyTaggedEntryIds).not.toHaveBeenCalled();
  });
});
