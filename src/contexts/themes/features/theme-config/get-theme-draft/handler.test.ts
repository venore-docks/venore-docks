import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/rbac", () => ({
  authorizeActor: async () => ({ authorized: false, error: { code: "rbac.authorization.unauthenticated", message: "x" } }),
}));
const getThemeDraft = vi.fn();
const discardThemeDraft = vi.fn();
const listThemeConfigHistory = vi.fn();
const publishThemeDraft = vi.fn();
const exportThemeConfig = vi.fn();
vi.mock("./service", () => ({ getThemeDraft }));
vi.mock("../discard-theme-draft/service", () => ({ discardThemeDraft }));
vi.mock("../list-theme-config-history/service", () => ({ listThemeConfigHistory }));
vi.mock("../publish-theme-draft/service", () => ({ publishThemeDraft }));
vi.mock("../export-theme-config/service", () => ({ exportThemeConfig }));

describe("handlers do ciclo de vida exigem settings.manage (spec §4.4)", () => {
  it("sem sessão nenhum service é chamado", async () => {
    const handlers = await Promise.all([
      import("./handler").then((m) => m.getThemeDraftHandler()),
      import("../discard-theme-draft/handler").then((m) => m.discardThemeDraftHandler()),
      import("../list-theme-config-history/handler").then((m) => m.listThemeConfigHistoryHandler()),
      import("../publish-theme-draft/handler").then((m) => m.publishThemeDraftHandler()),
      import("../export-theme-config/handler").then((m) => m.exportThemeConfigHandler()),
    ]);
    for (const result of handlers) expect(result).toMatchObject({ success: false, error: { code: "rbac.authorization.unauthenticated" } });
    for (const service of [getThemeDraft, discardThemeDraft, listThemeConfigHistory, publishThemeDraft, exportThemeConfig]) {
      expect(service).not.toHaveBeenCalled();
    }
  });
});
