import { describe, expect, it, vi } from "vitest";

// Banco falso: registra a sequência de operações da transação e responde aos SELECTs na ordem.
type Op = { op: string; values?: unknown };
const ops: Op[] = [];
let selectResults: unknown[][] = [];

function chain(resolveWith: () => unknown, record?: (method: string, args: unknown[]) => void): unknown {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === "then") return (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(resolveWith).then(resolve, reject);
      return (...args: unknown[]) => {
        record?.(String(prop), args);
        return chain(resolveWith, record);
      };
    },
  });
}

const tx = {
  select: () => chain(() => selectResults.shift() ?? []),
  update: () => {
    const op: Op = { op: "update" };
    ops.push(op);
    return chain(
      () => [{ id: "draft", status: "published" }],
      (method, args) => {
        if (method === "set") op.values = args[0];
      },
    );
  },
  delete: () => {
    ops.push({ op: "delete" });
    return chain(() => []);
  },
};
let transactionError: unknown = null;
vi.mock("@/infrastructure/database/client", () => ({
  db: {
    transaction: async (fn: (t: typeof tx) => unknown) => {
      if (transactionError) throw transactionError;
      return fn(tx);
    },
  },
}));

const { publishDraftTransaction, revertPublishTransaction, selectRevisionsToPrune } = await import("./store");

describe("selectRevisionsToPrune — histórico guarda 20 arquivados", () => {
  it("poda só o que passa de 20, os mais antigos", () => {
    const archived = Array.from({ length: 25 }, (_, index) => ({ id: `a${index}` }));
    expect(selectRevisionsToPrune(archived)).toEqual(["a20", "a21", "a22", "a23", "a24"]);
    expect(selectRevisionsToPrune(archived.slice(0, 20))).toEqual([]);
  });
});

describe("publishDraftTransaction", () => {
  it("arquiva o publicado ANTES de promover o rascunho, depois poda", async () => {
    ops.length = 0;
    const archived = Array.from({ length: 21 }, (_, index) => ({ id: `a${index}` }));
    selectResults = [[{ id: "draft", status: "draft" }], [{ id: "prev" }], archived];
    const now = new Date("2026-10-01T00:00:00Z");
    const result = await publishDraftTransaction({ actorId: "u1", now });
    expect(result.success && result.data?.previousPublishedId).toBe("prev");
    expect(result.success && result.data?.prunedIds).toEqual(["a20"]);
    expect(ops).toEqual([
      { op: "update", values: { status: "archived" } },
      { op: "update", values: { status: "published", publishedBy: "u1", publishedAt: now } },
      { op: "delete" },
    ]);
  });

  it("sem rascunho: null, nada alterado", async () => {
    ops.length = 0;
    selectResults = [[]];
    expect(await publishDraftTransaction({ actorId: "u1", now: new Date() })).toEqual({ success: true, data: null });
    expect(ops).toEqual([]);
  });

  it("primeira publicação (sem publicado anterior): só promove", async () => {
    ops.length = 0;
    selectResults = [[{ id: "draft" }], [], []];
    const result = await publishDraftTransaction({ actorId: "u1", now: new Date() });
    expect(result.success && result.data?.previousPublishedId).toBeNull();
    expect(ops.map((op) => op.op)).toEqual(["update"]);
  });

  it("42P01 vira themes.config.storage_unavailable", async () => {
    transactionError = Object.assign(new Error("x"), { cause: { code: "42P01" } });
    const result = await publishDraftTransaction({ actorId: "u1", now: new Date() });
    transactionError = null;
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.storage_unavailable" } });
  });
});

describe("revertPublishTransaction", () => {
  it("revisão volta a rascunho ANTES de a anterior voltar a publicada (índice único)", async () => {
    ops.length = 0;
    await revertPublishTransaction({ revisionId: "draft", previousPublishedId: "prev" });
    expect(ops).toEqual([
      { op: "update", values: { status: "draft", publishedBy: null, publishedAt: null } },
      { op: "update", values: { status: "published" } },
    ]);
  });
});
