import { describe, expect, it } from "vitest";
import { themePaletteChoiceSchema } from "@/contexts/themes/contracts/v8";
import {
  buildPalettePanelData,
  checkActivePaletteContrast,
  checkPaletteChoiceContrast,
  generateSeedChoice,
} from "./palette-admin";

const preset = { id: "oceano", name: "Oceano", light: { primary: "oklch(0.5 0.2 245)", accent: "oklch(0.6 0.1 210)" }, dark: {} };
const slime = { key: "venore-slime", colorPalettes: [preset], palette: {} };
const auroraLike = {
  key: "venore-slime",
  colorPalettes: [],
  palette: {
    regions: { rail: { tone: "dark" as const }, header: { tone: "inherit" as const } },
    presets: [{ id: "noite", name: "Noite", seed: "#1e3a8a" }],
    allowCustom: false,
    lockedTokens: ["--background"],
  },
};

describe("buildPalettePanelData", () => {
  it("catálogo vira presets com amostras; regras viram sementes, tons e travas", () => {
    expect(buildPalettePanelData(slime)).toEqual({
      themeKey: "venore-slime",
      presets: [{ id: "oceano", name: "Oceano", swatches: ["oklch(0.5 0.2 245)", "oklch(0.6 0.1 210)"] }],
      seedPresets: [],
      allowCustom: true,
      regionTones: [],
      lockedTokens: [],
    });
    expect(buildPalettePanelData(auroraLike)).toMatchObject({
      seedPresets: [{ id: "noite", seed: "#1e3a8a" }],
      allowCustom: false,
      regionTones: [{ region: "rail", tone: "dark", minContrast: null }],
      lockedTokens: ["--background"],
    });
  });
});

describe("generateSeedChoice", () => {
  it("devolve uma escolha `seed` válida pro schema do documento, com os tons de região do tema", () => {
    const result = generateSeedChoice(auroraLike, "#facc15");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(themePaletteChoiceSchema.safeParse(result.data.choice).success).toBe(true);
    expect(result.data.choice.generated.light["region-rail-background"]).toMatch(/^#/);
    expect(result.data.choice.generated.light.background).toBeUndefined(); // travado
    expect(result.data.problems.filter((problem) => problem.region === "rail")).toEqual([]);
  });

  it("recusa semente que não é hex/oklch estrito", () => {
    expect(generateSeedChoice(slime, "red")).toMatchObject({ success: false, error: { code: "theme-engine.palette.invalid_seed" } });
    expect(generateSeedChoice(slime, "oklch(0.5 0.1 200); }")).toMatchObject({ success: false });
  });
});

describe("contraste da escolha", () => {
  it("padrão do tema não introduz problema (a dívida do pacote fica de fora)", () => {
    expect(checkPaletteChoiceContrast(slime, { mode: "default" })).toEqual([]);
    expect(checkActivePaletteContrast(slime, null)).toEqual([]);
  });

  it("custom com texto ilegível aponta as regiões", () => {
    const problems = checkPaletteChoiceContrast(slime, {
      mode: "custom",
      light: { foreground: "#f5f5f5" },
      dark: {},
    });
    expect(problems.map((problem) => problem.region)).toEqual(expect.arrayContaining(["content", "footer"]));
    expect(problems.every((problem) => problem.mode === "light")).toBe(true);
    expect(problems[0].message).toContain("modo claro");
  });

  it("preset e seed usam os tokens da própria escolha", () => {
    expect(checkPaletteChoiceContrast(slime, { mode: "preset", presetId: "oceano" })).toEqual(expect.any(Array));
    expect(
      checkPaletteChoiceContrast(slime, { mode: "seed", seed: "#000000", generated: { light: { foreground: "#fefefe" }, dark: {} } }).length,
    ).toBeGreaterThan(0);
  });
});
