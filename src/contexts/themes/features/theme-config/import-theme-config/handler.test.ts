import { describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn(async () => ({ authorized: true, actorId: "u1" }));
const importThemeConfig = vi.fn(async (command: unknown) => ({ success: true, data: command }));
vi.mock("@/contexts/rbac", () => ({ authorizeActor: () => authorizeActor() }));
vi.mock("./service", () => ({ importThemeConfig: (command: unknown) => importThemeConfig(command) }));

const { importThemeConfigHandler } = await import("./handler");

describe("importThemeConfigHandler", () => {
  it("envelope inválido (zod): recusado com o caminho do problema", async () => {
    const result = await importThemeConfigHandler({ envelope: { format: "outro" } });
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.import_invalid" } });
    expect(importThemeConfig).not.toHaveBeenCalled();
  });

  it("envelope válido: delega com os avisos do composer", async () => {
    const envelope = {
      format: "venore-theme-config",
      formatVersion: 1,
      exportedAt: "x",
      coreContract: "8.0.0",
      theme: { key: "venore-slime", version: "1.0.0" },
      config: { schemaVersion: 1, themeKey: "venore-slime", byTheme: {}, assets: {}, sections: [] },
    };
    await importThemeConfigHandler({ envelope, warnings: ["a", 1 as never] });
    expect(importThemeConfig).toHaveBeenCalledWith({ envelope, warnings: ["a"], actorId: "u1" });
  });
});
