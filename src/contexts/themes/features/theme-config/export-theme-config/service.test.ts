import { describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.fn<(input: unknown) => Promise<void>>(async () => undefined);
vi.mock("@/observability", () => ({ recordAuditEvent: (input: unknown) => recordAuditEvent(input as never) }));
vi.mock("../get-published-theme-config/service", () => ({
  getPublishedThemeConfig: async () => ({
    success: true,
    data: {
      schemaVersion: 1,
      themeKey: "aurora",
      byTheme: { aurora: { palette: { mode: "default" }, options: {}, fonts: {} } },
      assets: {},
      sections: [],
      revisionId: "r1",
      publishedAt: "2026-09-01T00:00:00.000Z",
      source: "settings",
    },
  }),
}));

const { exportThemeConfig } = await import("./service");
const { themeConfigExportEnvelopeSchema } = await import("../../../contracts/v8/config-document");

describe("exportThemeConfig (spec §7.10)", () => {
  it("envelope válido pelo próprio schema de importação, sem metadado de publicação, e auditado", async () => {
    const result = await exportThemeConfig({ actorId: "u1", themeVersion: "0.2.0" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(themeConfigExportEnvelopeSchema.safeParse(result.data).success).toBe(true);
    expect(result.data).toMatchObject({ format: "venore-theme-config", formatVersion: 1, coreContract: "8.0.0", theme: { key: "aurora", version: "0.2.0" } });
    expect(result.data.config).not.toHaveProperty("revisionId");
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "themes.config.export", actor: { id: "u1", type: "user" } }));
  });
});
