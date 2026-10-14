import { describe, expect, it, vi } from "vitest";
import type { ThemeManifest } from "@/contexts/themes/contracts/types";
import type { ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import type { ThemeRegistryEntry } from "@/themes/registry";

vi.mock("@/contexts/themes", async (importOriginal) => {
  const rules = await importOriginal<typeof import("@/contexts/themes")>();
  return { isReservedSectionPrefix: rules.isReservedSectionPrefix };
});

const { THEME_REGISTRY } = await import("@/themes/registry");
const { validateThemeConfig } = await import("./validate-theme-config");

const fixtureManifest: ThemeManifest = {
  ...THEME_REGISTRY["venore-slime"].manifest,
  key: "fixture-opts",
  name: "Fixture",
  layout: { presetChoices: ["topbar", "rail"] },
  templateVariants: { entry: [{ value: "magazine", label: "Revista" }] },
  options: [
    { key: "density", label: "Densidade", type: "select", default: "cozy", choices: [{ value: "cozy", label: "C" }, { value: "compact", label: "K" }] },
    { key: "radius", label: "Raio", type: "range", default: 1, min: 0, max: 2, step: 0.5, unit: "rem" },
    { key: "glow", label: "Brilho", type: "boolean", default: false },
  ],
};
const registry: Record<string, ThemeRegistryEntry> = {
  "venore-slime": THEME_REGISTRY["venore-slime"],
  "fixture-opts": {
    contract: 8,
    manifest: fixtureManifest,
    definition: { manifest: fixtureManifest },
    colorPalettes: [{ id: "ember", name: "Ember", light: {}, dark: {} }],
    packageVersion: "1.0.0",
    packageName: null,
    lineage: ["fixture-opts"],
  },
};

const doc = (overrides: Partial<ThemeConfigDocument> = {}): ThemeConfigDocument => ({
  schemaVersion: 1,
  themeKey: "fixture-opts",
  byTheme: {
    "fixture-opts": {
      palette: { mode: "preset", presetId: "ember" },
      options: { density: "compact", radius: 1.5, glow: true, layout: "rail" },
      fonts: {},
    },
  },
  assets: {},
  sections: [],
  ...overrides,
});

describe("validateThemeConfig — contra o registro local (spec §4.3 passo 1, §7.10)", () => {
  it("documento válido passa intacto, sem avisos", () => {
    const result = validateThemeConfig(doc(), { registry });
    expect(result).toEqual({ config: doc(), warnings: [], errors: [] });
  });

  it("tema principal desconhecido ou desabilitado é erro", () => {
    expect(validateThemeConfig(doc({ themeKey: "nao-existe" }), { registry }).errors[0]?.code).toBe("themes.config.unknown_theme");
    expect(validateThemeConfig(doc(), { registry, isEnabled: (key) => key !== "fixture-opts" }).errors[0]?.code).toBe(
      "themes.config.unavailable_theme",
    );
  });

  it("opção desconhecida ou inválida é descartada com aviso", () => {
    const input = doc();
    input.byTheme["fixture-opts"].options = { density: "gigante", radius: 9, glow: "sim", nova: 1, layout: "lateral" };
    const result = validateThemeConfig(input, { registry });
    expect(result.errors).toEqual([]);
    expect(result.config.byTheme["fixture-opts"].options).toEqual({});
    expect(result.warnings).toHaveLength(5);
  });

  it("paleta preset inexistente volta para a padrão; config de tema não instalado é descartada", () => {
    const input = doc();
    input.byTheme["fixture-opts"].palette = { mode: "preset", presetId: "sumiu" };
    input.byTheme["velho"] = { palette: { mode: "default" }, options: {}, fonts: {} };
    const result = validateThemeConfig(input, { registry });
    expect(result.config.byTheme["fixture-opts"].palette).toEqual({ mode: "default" });
    expect(result.config.byTheme).not.toHaveProperty("velho");
    expect(result.warnings).toHaveLength(2);
  });

  it("seção: tema indisponível sai (fica o do site), variante inexistente sai, prefixo é normalizado", () => {
    const result = validateThemeConfig(
      doc({
        sections: [
          { id: "rh", label: "RH", pathPrefix: "RH/", themeKey: "sumiu", templates: { entry: "magazine", category: "grade" } },
        ],
      }),
      { registry },
    );
    expect(result.errors).toEqual([]);
    expect(result.config.sections).toEqual([{ id: "rh", label: "RH", pathPrefix: "/rh", templates: { entry: "magazine" } }]);
    expect(result.warnings).toHaveLength(2);
  });

  it("seção em prefixo reservado é erro", () => {
    const result = validateThemeConfig(doc({ sections: [{ id: "a", label: "A", pathPrefix: "/login" }] }), { registry });
    expect(result.errors[0]?.code).toBe("themes.config.section_reserved_prefix");
  });
});
