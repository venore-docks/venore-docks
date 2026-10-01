import { describe, expect, it, vi } from "vitest";

const exportPublishedThemeConfig = vi.fn();
vi.mock("@/platform/theme-engine/theme-config", () => ({ exportPublishedThemeConfig: () => exportPublishedThemeConfig() }));

const { GET } = await import("./route");

describe("GET /api/themes/config/export (spec §7.10)", () => {
  it("devolve o envelope como download JSON", async () => {
    const envelope = {
      format: "venore-theme-config",
      formatVersion: 1,
      exportedAt: "2026-10-01T12:00:00.000Z",
      coreContract: "8.0.0",
      theme: { key: "aurora", version: "0.2.0" },
      config: { schemaVersion: 1, themeKey: "aurora", byTheme: {}, assets: {}, sections: [] },
    };
    exportPublishedThemeConfig.mockResolvedValueOnce({ success: true, data: envelope });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="venore-aparencia-aurora-2026-10-01.json"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(envelope);
  });

  it("sem sessão: 401; sem permissão: 403", async () => {
    exportPublishedThemeConfig.mockResolvedValueOnce({ success: false, error: { code: "rbac.authorization.unauthenticated", message: "x" } });
    expect((await GET()).status).toBe(401);
    exportPublishedThemeConfig.mockResolvedValueOnce({ success: false, error: { code: "rbac.authorization.forbidden", message: "x" } });
    expect((await GET()).status).toBe(403);
  });
});
