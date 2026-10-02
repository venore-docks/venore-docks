import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
}));

const findEntryById = vi.fn();
const saveEntryData = vi.fn();
vi.mock("./store", () => ({
  findEntryById: (...args: unknown[]) => findEntryById(...args),
  saveEntryData: (...args: unknown[]) => saveEntryData(...args),
}));

const assertCmsCategoryScope = vi.fn();
vi.mock("../../../shared/scoped-authorization", () => ({
  assertCmsCategoryScope: (...args: unknown[]) => assertCmsCategoryScope(...args),
}));

const canPublishInCategory = vi.fn();
const recordProposal = vi.fn();
const recordSnapshot = vi.fn();
vi.mock("../../../shared/entry-revisions", () => ({
  canPublishInCategory: (...args: unknown[]) => canPublishInCategory(...args),
  isLive: (entry: { status: string }) => entry.status === "published",
  recordProposal: (...args: unknown[]) => recordProposal(...args),
  recordSnapshot: (...args: unknown[]) => recordSnapshot(...args),
  stateOf: (entry: Record<string, unknown>) => ({ title: entry.title, data: entry.data }),
}));

const { updateEntryLayout } = await import("./service");

const blocks = [{ id: "b1", key: "core.content.heading", slot: "root", htmlId: null, data: {}, areas: [] }];
const draftEntry = {
  id: "entry-1",
  categoryId: "cat-a",
  title: "Olá",
  slug: "ola",
  status: "draft",
  contentTypeIds: ["ct"],
  data: { blocks, body: "legado", layout: { width: "full" } },
};

describe("updateEntryLayout", () => {
  beforeEach(() => {
    for (const mock of [findEntryById, saveEntryData, assertCmsCategoryScope, canPublishInCategory, recordProposal, recordSnapshot]) mock.mockReset();
    assertCmsCategoryScope.mockResolvedValue({ success: true, data: undefined });
    canPublishInCategory.mockResolvedValue(true);
    recordProposal.mockResolvedValue({ id: "proposal-1" });
    saveEntryData.mockImplementation(async (id: string, data: unknown) => ({ ...draftEntry, id, data }));
  });

  it("entry inexistente → not_found, nada gravado", async () => {
    findEntryById.mockResolvedValue(null);
    const result = await updateEntryLayout({ entryId: "x", layout: {}, actorId: "a" });
    expect(result).toMatchObject({ success: false, error: { code: "cms.entries.not_found" } });
    expect(saveEntryData).not.toHaveBeenCalled();
  });

  it("fora do escopo da categoria (escopo CMS) → erro do escopo, nada gravado", async () => {
    findEntryById.mockResolvedValue(draftEntry);
    assertCmsCategoryScope.mockResolvedValue({ success: false, error: { code: "cms.entries.forbidden_scope", message: "fora" } });
    const result = await updateEntryLayout({ entryId: "entry-1", layout: { width: "wide" }, actorId: "a" });
    expect(assertCmsCategoryScope).toHaveBeenCalledWith("a", ["cms.entries.manage"], "cat-a");
    expect(result).toEqual({ success: false, error: { code: "cms.entries.forbidden_scope", message: "fora" } });
    expect(saveEntryData).not.toHaveBeenCalled();
    expect(recordProposal).not.toHaveBeenCalled();
  });

  it("rascunho: troca só data.layout (blocks/body preservados) e grava snapshot antes", async () => {
    findEntryById.mockResolvedValue(draftEntry);
    const result = await updateEntryLayout({ entryId: "entry-1", layout: { width: "wide", rail: "hidden" }, actorId: "a" });
    expect(result).toEqual({ success: true, data: { entryId: "entry-1", layout: { width: "wide", rail: "hidden" }, proposed: false } });
    expect(recordSnapshot).toHaveBeenCalledTimes(1);
    expect(saveEntryData).toHaveBeenCalledWith("entry-1", { blocks, body: "legado", layout: { width: "wide", rail: "hidden" } });
  });

  it("layout vazio remove a chave (volta a herdar)", async () => {
    findEntryById.mockResolvedValue(draftEntry);
    await updateEntryLayout({ entryId: "entry-1", layout: {}, actorId: "a" });
    expect(saveEntryData).toHaveBeenCalledWith("entry-1", { blocks, body: "legado" });
  });

  it("publicada + ator sem cms.entries.publish na categoria → proposta, entry intocada", async () => {
    findEntryById.mockResolvedValue({ ...draftEntry, status: "published" });
    canPublishInCategory.mockResolvedValue(false);
    const result = await updateEntryLayout({ entryId: "entry-1", layout: { contextualBar: "none" }, actorId: "author" });
    expect(canPublishInCategory).toHaveBeenCalledWith("author", "cat-a");
    expect(result).toEqual({ success: true, data: { entryId: "entry-1", layout: { contextualBar: "none" }, proposed: true } });
    expect(recordProposal).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({ contentTypeIds: null, data: { blocks, body: "legado", layout: { contextualBar: "none" } } }),
      "author",
    );
    expect(saveEntryData).not.toHaveBeenCalled();
    expect(recordSnapshot).not.toHaveBeenCalled();
  });

  it("publicada + ator que publica na categoria → grava direto", async () => {
    findEntryById.mockResolvedValue({ ...draftEntry, status: "published" });
    const result = await updateEntryLayout({ entryId: "entry-1", layout: { template: "magazine" }, actorId: "editor" });
    expect(result).toMatchObject({ success: true, data: { proposed: false } });
    expect(saveEntryData).toHaveBeenCalledWith("entry-1", { blocks, body: "legado", layout: { template: "magazine" } });
  });

  it("revalida o layout no service (chamada direta com valor inválido)", async () => {
    const result = await updateEntryLayout({ entryId: "entry-1", layout: { width: "giant" } as never, actorId: "a" });
    expect(result).toMatchObject({ success: false, error: { code: "cms.entries.invalid_layout" } });
    expect(findEntryById).not.toHaveBeenCalled();
  });
});
