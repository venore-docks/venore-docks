import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../../../contracts/block";
import type { BlockDefinition } from "../../../contracts/block-definition";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const findEntryById = vi.fn();
const saveEntryComposition = vi.fn();

vi.mock("./store", () => ({
  findEntryById: (...args: unknown[]) => findEntryById(...args),
  saveEntryComposition: (...args: unknown[]) => saveEntryComposition(...args),
}));

const assertCmsCategoryScope = vi.fn();
vi.mock("../../../shared/scoped-authorization", () => ({
  assertCmsCategoryScope: (...args: unknown[]) => assertCmsCategoryScope(...args),
}));

const textDefinition: BlockDefinition = {
  key: "text",
  label: "Texto",
  category: "content",
  structure: "leaf",
  defaultData: {},
  editorFields: [],
  allowedInRoot: true,
};

function resolveDefinition(key: string): BlockDefinition | null {
  return key === "text" ? textDefinition : null;
}

const existingEntry = {
  id: "entry-1",
  contentTypeId: "ct-1",
  categoryId: null,
  title: "Hello",
  slug: "hello",
  status: "draft",
  data: { body: "legacy" },
  mediaId: null,
  authorId: "actor-1",
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function block(overrides: Partial<Block>): Block {
  return { id: "b1", key: "text", slot: "main", htmlId: null, data: {}, areas: [], ...overrides };
}

describe("updateEntryComposition", () => {
  beforeEach(() => {
    findEntryById.mockReset();
    saveEntryComposition.mockReset();
    assertCmsCategoryScope.mockReset();
    assertCmsCategoryScope.mockResolvedValue({ success: true, data: undefined });
  });

  it("rejects when the actor's scope does not reach the entry's category (Fase C)", async () => {
    findEntryById.mockResolvedValue({ ...existingEntry, categoryId: "cat-a" });
    assertCmsCategoryScope.mockResolvedValue({
      success: false,
      error: { code: "cms.entries.forbidden_scope", message: "fora do escopo" },
    });

    const { updateEntryComposition } = await import("./service");
    const result = await updateEntryComposition({
      id: "entry-1",
      composition: [],
      resolveDefinition,
      actorId: "actor-1",
    });

    expect(result.success).toBe(false);
    expect(assertCmsCategoryScope).toHaveBeenCalledWith("actor-1", ["cms.entries.manage"], "cat-a");
    expect(saveEntryComposition).not.toHaveBeenCalled();
  });

  it("fails when the entry does not exist", async () => {
    findEntryById.mockResolvedValue(null);

    const { updateEntryComposition } = await import("./service");
    const result = await updateEntryComposition({
      id: "missing",
      composition: [],
      resolveDefinition,
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.entries.not_found", message: expect.any(String) },
    });
    expect(saveEntryComposition).not.toHaveBeenCalled();
  });

  it("fails when the composition references an unknown block key", async () => {
    findEntryById.mockResolvedValue(existingEntry);

    const { updateEntryComposition } = await import("./service");
    const result = await updateEntryComposition({
      id: "entry-1",
      composition: [block({ key: "mystery" })],
      resolveDefinition,
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.composition.unknown_block", message: expect.any(String) },
    });
    expect(saveEntryComposition).not.toHaveBeenCalled();
  });

  it("fails when a block is placed in an area it does not belong to", async () => {
    findEntryById.mockResolvedValue(existingEntry);

    const columnsDefinition: BlockDefinition = {
      key: "columns",
      label: "Colunas",
      category: "layout",
      structure: "areas",
      defaultData: {},
      editorFields: [],
      allowedInRoot: true,
      areaDefinitions: [{ key: "left", label: "Esquerda", allowedBlockKeys: [] }],
    };
    const resolve = (key: string): BlockDefinition | null =>
      key === "columns" ? columnsDefinition : key === "text" ? textDefinition : null;

    const { updateEntryComposition } = await import("./service");
    const result = await updateEntryComposition({
      id: "entry-1",
      composition: [
        block({
          id: "b1",
          key: "columns",
          areas: [{ key: "left", blocks: [block({ id: "b2", key: "text" })] }],
        }),
      ],
      resolveDefinition: resolve,
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.composition.block_not_allowed_in_area", message: expect.any(String) },
    });
    expect(saveEntryComposition).not.toHaveBeenCalled();
  });

  it("fails when the composition exceeds the max depth", async () => {
    findEntryById.mockResolvedValue(existingEntry);

    const columnsDefinition: BlockDefinition = {
      key: "columns",
      label: "Colunas",
      category: "layout",
      structure: "areas",
      defaultData: {},
      editorFields: [],
      allowedInRoot: true,
      areaDefinitions: [{ key: "left", label: "Esquerda", allowedBlockKeys: ["columns", "text"] }],
    };
    const resolve = (key: string): BlockDefinition | null =>
      key === "columns" ? columnsDefinition : key === "text" ? textDefinition : null;

    function nest(depth: number): Block {
      if (depth === 0) return block({ id: `leaf-${depth}`, key: "text" });
      return block({
        id: `columns-${depth}`,
        key: "columns",
        areas: [{ key: "left", blocks: [nest(depth - 1)] }],
      });
    }

    const { updateEntryComposition } = await import("./service");
    const result = await updateEntryComposition({
      id: "entry-1",
      composition: [nest(7)],
      resolveDefinition: resolve,
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.composition.max_depth_exceeded", message: expect.any(String) },
    });
    expect(saveEntryComposition).not.toHaveBeenCalled();
  });

  it("saves a valid composition merged into data, preserving other data keys", async () => {
    findEntryById.mockResolvedValue(existingEntry);
    const composition = [block({ id: "b1", key: "text" })];
    saveEntryComposition.mockResolvedValue({ ...existingEntry, data: { body: "legacy", blocks: composition } });

    const { updateEntryComposition } = await import("./service");
    const result = await updateEntryComposition({
      id: "entry-1",
      composition,
      resolveDefinition,
      actorId: "actor-1",
    });

    expect(result.success).toBe(true);
    expect(saveEntryComposition).toHaveBeenCalledWith("entry-1", { body: "legacy", blocks: composition });
  });
});
