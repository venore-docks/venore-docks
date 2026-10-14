import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertDraftRevision = vi.fn();
vi.mock("./store", () => ({ upsertDraftRevision: (values: unknown) => upsertDraftRevision(values) }));
vi.mock("@/observability", () => ({ beginOperation: () => ({}), endOperation: () => undefined }));

const { saveThemeDraft } = await import("./service");
const ID = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";
const config = (sections: unknown[]) => ({ schemaVersion: 1 as const, themeKey: "venore-slime", byTheme: {}, assets: {}, sections }) as never;

beforeEach(() => {
  upsertDraftRevision.mockReset();
  upsertDraftRevision.mockImplementation(async (values: { config: unknown }) => ({
    success: true,
    data: { id: ID, status: "draft", config: values.config, basedOnRevisionId: null, note: null, createdBy: "u1", createdAt: new Date(), publishedBy: null, publishedAt: null },
  }));
});

describe("saveThemeDraft", () => {
  it("normaliza os prefixos das seções antes de gravar", async () => {
    const result = await saveThemeDraft({ config: config([{ id: "rh", label: "RH", pathPrefix: "RH/" }]), actorId: "u1" });
    expect(result.success && result.data.config.sections[0].pathPrefix).toBe("/rh");
    expect(upsertDraftRevision).toHaveBeenCalledWith(expect.objectContaining({ actorId: "u1" }));
  });

  it("prefixo reservado: recusado sem gravar", async () => {
    const result = await saveThemeDraft({ config: config([{ id: "a", label: "Admin", pathPrefix: "/admin" }]), actorId: "u1" });
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.section_reserved_prefix" } });
    expect(upsertDraftRevision).not.toHaveBeenCalled();
  });

  it("tabela ausente: erro de storage (o admin mostra o aviso)", async () => {
    upsertDraftRevision.mockResolvedValueOnce({ success: false, error: { code: "themes.config.storage_unavailable", message: "x" } });
    expect(await saveThemeDraft({ config: config([]), actorId: "u1" })).toMatchObject({ success: false, error: { code: "themes.config.storage_unavailable" } });
  });
});
