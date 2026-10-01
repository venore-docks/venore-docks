import { describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
const rollbackThemeConfig = vi.fn();
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (permission: string) => authorizeActor(permission) }));
vi.mock("./service", () => ({ rollbackThemeConfig: (command: unknown) => rollbackThemeConfig(command) }));

const { rollbackThemeConfigHandler } = await import("./handler");
const ID = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";

describe("rollbackThemeConfigHandler", () => {
  it("revisionId inválido: recusa antes de autorizar", async () => {
    expect(await rollbackThemeConfigHandler({ revisionId: "x" })).toMatchObject({ success: false, error: { code: "themes.config.invalid_revision_id" } });
    expect(authorizeActor).not.toHaveBeenCalled();
  });

  it("exige settings.manage", async () => {
    authorizeActor.mockResolvedValueOnce({ authorized: false, error: { code: "rbac.authorization.forbidden", message: "não" } });
    expect(await rollbackThemeConfigHandler({ revisionId: ID })).toMatchObject({ success: false, error: { code: "rbac.authorization.forbidden" } });
    expect(authorizeActor).toHaveBeenCalledWith("settings.manage");
    expect(rollbackThemeConfig).not.toHaveBeenCalled();
  });

  it("autorizado: delega com o ator", async () => {
    authorizeActor.mockResolvedValueOnce({ authorized: true, actorId: "u1" });
    rollbackThemeConfig.mockResolvedValueOnce({ success: true, data: { id: "novo" } });
    await rollbackThemeConfigHandler({ revisionId: ID });
    expect(rollbackThemeConfig).toHaveBeenCalledWith({ revisionId: ID, actorId: "u1" });
  });
});
