import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
const saveThemeDraft = vi.fn(async (command: unknown) => ({ success: true, data: command }));
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (permission: string) => authorizeActor(permission) }));
vi.mock("./service", () => ({ saveThemeDraft: (command: unknown) => saveThemeDraft(command) }));

const { saveThemeDraftHandler } = await import("./handler");
const config = { schemaVersion: 1, themeKey: "venore-slime", byTheme: {}, assets: {}, sections: [] };

beforeEach(() => {
  authorizeActor.mockReset();
  saveThemeDraft.mockClear();
});

describe("saveThemeDraftHandler", () => {
  it("documento fora do schema (.strict()) é recusado antes de autorizar", async () => {
    expect(await saveThemeDraftHandler({ config: { ...config, extra: 1 } as never })).toMatchObject({
      success: false,
      error: { code: "themes.config.invalid_document" },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
  });

  it("basedOnRevisionId precisa ser uuid", async () => {
    expect(await saveThemeDraftHandler({ config: config as never, basedOnRevisionId: "x" })).toMatchObject({
      success: false,
      error: { code: "themes.config.invalid_revision_id" },
    });
  });

  it("sem settings.manage: recusado, nada salvo", async () => {
    authorizeActor.mockResolvedValueOnce({ authorized: false, error: { code: "rbac.authorization.unauthenticated", message: "x" } });
    expect((await saveThemeDraftHandler({ config: config as never })).success).toBe(false);
    expect(authorizeActor).toHaveBeenCalledWith("settings.manage");
    expect(saveThemeDraft).not.toHaveBeenCalled();
  });

  it("autorizado: salva com o ator", async () => {
    authorizeActor.mockResolvedValueOnce({ authorized: true, actorId: "u1" });
    await saveThemeDraftHandler({ config: config as never });
    expect(saveThemeDraft).toHaveBeenCalledWith({ config, basedOnRevisionId: undefined, note: undefined, actorId: "u1" });
  });
});
