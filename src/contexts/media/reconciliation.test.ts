import { beforeEach, describe, expect, it, vi } from "vitest";

const selectFrom = vi.fn();
const selectMock = vi.fn(() => ({ from: selectFrom }));

vi.mock("@/infrastructure/database/client", () => ({
  db: { select: selectMock },
}));

const listObjects = vi.fn();
const remove = vi.fn();
vi.mock("@/infrastructure/storage", () => ({
  storagePort: { listObjects: (...args: unknown[]) => listObjects(...args), remove: (...args: unknown[]) => remove(...args) },
}));

describe("reconcileOrphanUploads", () => {
  beforeEach(() => {
    selectMock.mockClear();
    selectFrom.mockReset();
    // 2ª query (pathnames de asset_variants) — vazia por padrão.
    selectFrom.mockResolvedValue([]);
    listObjects.mockReset();
    remove.mockReset();
  });

  it("removes nothing when every storage object has a known row", async () => {
    selectFrom.mockResolvedValueOnce([{ pathname: "a.png" }, { pathname: "b.png" }]);
    listObjects.mockResolvedValueOnce([
      { key: "a.png", size: 10, uploadedAt: new Date("2026-01-01") },
      { key: "b.png", size: 10, uploadedAt: new Date("2026-01-01") },
    ]);

    const { reconcileOrphanUploads } = await import("./reconciliation");
    const result = await reconcileOrphanUploads(new Date("2026-01-05"));

    expect(result).toEqual({ removed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes an object with no matching row once it is older than the grace period", async () => {
    selectFrom.mockResolvedValueOnce([]);
    listObjects.mockResolvedValueOnce([{ key: "orphan.png", size: 10, uploadedAt: new Date("2026-01-01T00:00:00.000Z") }]);

    const { reconcileOrphanUploads } = await import("./reconciliation");
    // 2 dias depois — passou do TTL de graça de 24h.
    const result = await reconcileOrphanUploads(new Date("2026-01-03T00:00:00.000Z"));

    expect(result).toEqual({ removed: 1 });
    expect(remove).toHaveBeenCalledWith("orphan.png");
  });

  it("does not remove an orphan still inside the grace period", async () => {
    selectFrom.mockResolvedValueOnce([]);
    const uploadedAt = new Date("2026-01-01T00:00:00.000Z");
    listObjects.mockResolvedValueOnce([{ key: "fresh.png", size: 10, uploadedAt }]);

    const { reconcileOrphanUploads } = await import("./reconciliation");
    // 1h depois do upload — bem dentro da janela de 24h.
    const result = await reconcileOrphanUploads(new Date(uploadedAt.getTime() + 60 * 60 * 1000));

    expect(result).toEqual({ removed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("treats soft-deleted rows as known (not orphans) since the blob still exists until purge", async () => {
    // A query em si não filtra deletedAt — confirma que o pathname de uma linha soft-deletada
    // ainda conta como "conhecido".
    selectFrom.mockResolvedValueOnce([{ pathname: "soft-deleted.png" }]);
    listObjects.mockResolvedValueOnce([{ key: "soft-deleted.png", size: 10, uploadedAt: new Date("2020-01-01") }]);

    const { reconcileOrphanUploads } = await import("./reconciliation");
    const result = await reconcileOrphanUploads(new Date("2026-01-05"));

    expect(result).toEqual({ removed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("treats image variants as known objects, not orphans", async () => {
    selectFrom.mockResolvedValueOnce([{ pathname: "Imagens/u-foto.jpg" }]).mockResolvedValueOnce([{ pathname: "Imagens/u-foto.w480.webp" }]);
    listObjects.mockResolvedValueOnce([
      { key: "Imagens/u-foto.jpg", size: 10, uploadedAt: new Date("2026-01-01") },
      { key: "Imagens/u-foto.w480.webp", size: 10, uploadedAt: new Date("2026-01-01") },
    ]);

    const { reconcileOrphanUploads } = await import("./reconciliation");
    const result = await reconcileOrphanUploads(new Date("2026-01-05"));

    expect(result).toEqual({ removed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });
});
