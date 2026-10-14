import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const settings = new Map<string, unknown>();
let failWriteFor: string | null = null;
let throwWriteFor: string | null = null;
let transactionResult: unknown;

const DRAFT_ID = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";
const PREVIOUS_ID = "1b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f61";
const document = {
  schemaVersion: 1,
  themeKey: "nite",
  byTheme: { nite: { palette: { mode: "preset", presetId: "ember" }, options: {}, fonts: {} } },
  assets: {},
  sections: [],
};
const publishedRow = () => ({
  id: DRAFT_ID,
  status: "published",
  config: document,
  basedOnRevisionId: PREVIOUS_ID,
  note: null,
  createdBy: "u1",
  createdAt: new Date("2026-09-30T10:00:00Z"),
  publishedBy: "u1",
  publishedAt: new Date("2026-10-01T10:00:00Z"),
});

vi.mock("./store", () => ({
  publishDraftTransaction: vi.fn(async () => {
    calls.push("history:transaction");
    return transactionResult;
  }),
  revertPublishTransaction: vi.fn(async (input: unknown) => {
    calls.push(`history:revert:${JSON.stringify(input)}`);
    return { success: true, data: undefined };
  }),
}));
vi.mock("@/contexts/settings", () => ({
  getSetting: async ({ key }: { key: string }) => {
    calls.push(`settings:read:${key}`);
    return { success: true, data: settings.has(key) ? { key, value: settings.get(key), updatedAt: new Date() } : null };
  },
  setSetting: async ({ key, value }: { key: string; value: unknown }) => {
    calls.push(`settings:write:${key}`);
    if (throwWriteFor === key) throw new Error("db caiu");
    if (failWriteFor === key) return { success: false, error: { code: "x", message: "falhou" } };
    settings.set(key, value);
    return { success: true, data: { key, value, updatedAt: new Date() } };
  },
}));
const recordAuditEvent = vi.fn(async (input: { action: string }) => void calls.push(`audit:${input.action}`));
vi.mock("@/observability", () => ({
  beginOperation: () => ({}),
  endOperation: () => undefined,
  recordAuditEvent: (input: { action: string }) => recordAuditEvent(input),
}));

const { publishThemeDraft } = await import("./service");

beforeEach(() => {
  calls.length = 0;
  settings.clear();
  failWriteFor = null;
  throwWriteFor = null;
  recordAuditEvent.mockClear();
  transactionResult = { success: true, data: { revision: publishedRow(), previousPublishedId: PREVIOUS_ID, prunedIds: [] } };
});

describe("publishThemeDraft (spec §4.3)", () => {
  it("histórico (transação) primeiro, depois settings (theme.config + legadas), depois auditoria", async () => {
    const result = await publishThemeDraft({ actorId: "u1" });
    expect(result.success && result.data.id).toBe(DRAFT_ID);
    const writes = calls.filter((call) => !call.startsWith("settings:read"));
    expect(writes).toEqual([
      "history:transaction",
      "settings:write:theme.config",
      "settings:write:theme.active",
      "settings:write:theme.activePaletteId",
      "audit:themes.config.publish",
    ]);
    expect(settings.get("theme.config")).toEqual({ ...document, revisionId: DRAFT_ID, publishedAt: "2026-10-01T10:00:00.000Z" });
    expect(settings.get("theme.active")).toBe("nite");
    expect(settings.get("theme.activePaletteId")).toBe("ember");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "themes.config.publish",
        actor: { id: "u1", type: "user" },
        outcome: "success",
        detail: expect.objectContaining({ revisionId: DRAFT_ID, themeKey: "nite", previousRevisionId: PREVIOUS_ID }),
      }),
    );
  });

  it("falha numa chave legada: desfaz as já gravadas, reverte o histórico e não audita", async () => {
    settings.set("theme.config", { old: true });
    failWriteFor = "theme.active";
    const result = await publishThemeDraft({ actorId: "u1" });
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.publish_failed" } });
    expect(settings.get("theme.config")).toEqual({ old: true });
    expect(calls).toContain(`history:revert:${JSON.stringify({ revisionId: DRAFT_ID, previousPublishedId: PREVIOUS_ID })}`);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("falha (exceção) já no theme.config: reverte o histórico; nada novo fica no settings", async () => {
    throwWriteFor = "theme.config";
    const result = await publishThemeDraft({ actorId: "u1" });
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.publish_failed" } });
    expect(settings.has("theme.config")).toBe(false);
    expect(calls.some((call) => call.startsWith("history:revert"))).toBe(true);
  });

  it("chave que não existia antes volta como false (jsonb NOT NULL; o read path trata como ausente)", async () => {
    failWriteFor = "theme.activePaletteId";
    await publishThemeDraft({ actorId: "u1" });
    expect(settings.get("theme.config")).toBe(false);
    expect(settings.get("theme.active")).toBe(false);
  });

  it("sem rascunho: themes.config.no_draft, sem tocar no settings", async () => {
    transactionResult = { success: true, data: null };
    const result = await publishThemeDraft({ actorId: "u1" });
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.no_draft" } });
    expect(calls).toEqual(["history:transaction"]);
  });

  it("tabela ausente (42P01): o erro de storage sobe, nada no settings", async () => {
    transactionResult = { success: false, error: { code: "themes.config.storage_unavailable", message: "x" } };
    const result = await publishThemeDraft({ actorId: "u1" });
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.storage_unavailable" } });
    expect(calls).toEqual(["history:transaction"]);
  });

  it("rollback reaproveita os passos com a própria ação de auditoria", async () => {
    await publishThemeDraft({ actorId: "u1", audit: { action: "themes.config.rollback", detail: { rolledBackTo: PREVIOUS_ID } } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "themes.config.rollback", detail: expect.objectContaining({ rolledBackTo: PREVIOUS_ID }) }),
    );
  });

  it("auditoria que falha não desfaz a publicação", async () => {
    recordAuditEvent.mockRejectedValueOnce(new Error("audit off"));
    const result = await publishThemeDraft({ actorId: "u1" });
    expect(result.success).toBe(true);
    expect(calls.some((call) => call.startsWith("history:revert"))).toBe(false);
  });
});
