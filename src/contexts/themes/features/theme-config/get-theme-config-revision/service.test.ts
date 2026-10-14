import { describe, expect, it, vi } from "vitest";

const limit = vi.fn();
vi.mock("@/infrastructure/database/client", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) },
}));

const ID = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";

describe("getThemeConfigRevision", () => {
  it("42P01 (tabela ausente) vira themes.config.storage_unavailable, sem lançar", async () => {
    limit.mockRejectedValueOnce(Object.assign(new Error("query failed"), { cause: { code: "42P01" } }));
    const { getThemeConfigRevision } = await import("./service");
    const result = await getThemeConfigRevision({ revisionId: ID });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.code).toBe("themes.config.storage_unavailable");
  });

  it("outros erros de banco continuam sendo exceção (falha de infra)", async () => {
    limit.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "57P01" }));
    const { getThemeConfigRevision } = await import("./service");
    await expect(getThemeConfigRevision({ revisionId: ID })).rejects.toThrow("boom");
  });

  it("id que não é uuid: null sem consultar", async () => {
    const { getThemeConfigRevision } = await import("./service");
    limit.mockClear();
    expect(await getThemeConfigRevision({ revisionId: "x" })).toEqual({ success: true, data: null });
    expect(limit).not.toHaveBeenCalled();
  });

  it("mapeia a linha e valida o documento", async () => {
    limit.mockResolvedValueOnce([
      {
        id: ID,
        status: "draft",
        config: { schemaVersion: 1, themeKey: "venore-slime", byTheme: {}, assets: {}, sections: [] },
        basedOnRevisionId: null,
        note: null,
        createdBy: "u1",
        createdAt: new Date("2026-09-01T00:00:00Z"),
        publishedBy: null,
        publishedAt: null,
      },
    ]);
    const { getThemeConfigRevision } = await import("./service");
    const result = await getThemeConfigRevision({ revisionId: ID });
    expect(result.success && result.data?.createdAt).toBe("2026-09-01T00:00:00.000Z");
    expect(result.success && result.data?.status).toBe("draft");
  });
});
