import { describe, expect, it } from "vitest";
import { OPTION_FIELDS } from "@/platform/theme-rendering/theme-options-pipeline.fixture";
import {
  buildThemeOptionsSchema,
  isValidOptionValue,
  parseThemeOptionsFormData,
  resolveThemeText,
  toSchemaFormFields,
  toSchemaFormValues,
  validateThemeOptionFields,
} from "./theme-options";

const field = (key: string) => OPTION_FIELDS.find((f) => f.key === key)!;

describe("declarações", () => {
  it("aceita as válidas e reprova chave reservada, padrão fora, duplicada, when órfão", () => {
    const result = validateThemeOptionFields([
      ...OPTION_FIELDS,
      { key: "layout", label: "x", type: "boolean", default: true },
      { key: "s", label: "x", type: "select", default: "z", choices: [{ value: "a", label: "A" }] },
      { key: "r", label: "x", type: "range", default: 0.3, min: 0, max: 1, step: 0.25, unit: "px" },
      { key: "density", label: "x", type: "boolean", default: true },
      { key: "w", label: "x", type: "boolean", default: true, when: { key: "nope", equals: true } },
      { key: "Bad", label: "x", type: "boolean", default: true },
    ]);
    expect(result.fields.map((f) => f.key)).toEqual([...OPTION_FIELDS.map((f) => f.key), "w"]);
    expect(result.errors).toHaveLength(6);
  });
});

describe("valores", () => {
  it("valida por tipo", () => {
    expect(isValidOptionValue(field("density"), "compact")).toBe(true);
    expect(isValidOptionValue(field("density"), "huge")).toBe(false);
    expect(isValidOptionValue(field("gap"), 0.75)).toBe(true);
    expect(isValidOptionValue(field("gap"), 0.8)).toBe(false);
    expect(isValidOptionValue(field("brand"), "oklch(0.5 0.1 200)")).toBe(true);
    expect(isValidOptionValue(field("brand"), "url(x)")).toBe(false);
    expect(isValidOptionValue(field("display"), "inter")).toBe(true);
    expect(isValidOptionValue(field("display"), "comic")).toBe(false);
    expect(isValidOptionValue(field("rounded"), null)).toBe(true);
    expect(buildThemeOptionsSchema(OPTION_FIELDS).safeParse({ density: "compact", extra: 1 }).success).toBe(false);
  });

  it("FormData: checkbox ausente = false, vazio = null, erro por campo", () => {
    const fd = new FormData();
    fd.set("option.density", "compact");
    fd.set("option.gap", "1.5");
    fd.set("option.brand", "");
    fd.set("option.tagline", "ok");
    expect(parseThemeOptionsFormData(OPTION_FIELDS, fd)).toEqual({
      success: true,
      values: { density: "compact", rounded: false, gap: 1.5, brand: null, tagline: "ok", logo: null, display: null },
    });
    fd.set("option.gap", "abc");
    fd.set("option.density", "x");
    const bad = parseThemeOptionsFormData(OPTION_FIELDS, fd);
    expect(bad.success).toBe(false);
    if (!bad.success) expect(Object.keys(bad.fieldErrors).sort()).toEqual(["density", "gap"]);
  });

  it("texto do tema e campos do formulário", () => {
    expect(resolveThemeText({ messageKey: "k" }, { "pt-BR": { k: "Olá" } })).toBe("Olá");
    expect(resolveThemeText({ messageKey: "k" })).toBe("k");
    const fields = toSchemaFormFields({ options: OPTION_FIELDS, fontChoices: { display: ["inter", "fraunces"] } });
    expect(fields.map((f) => f.type)).toEqual(["select", "boolean", "range", "color", "text", "media", "select"]);
    expect(fields[6]).toMatchObject({ name: "option.display", emptyLabel: "Padrão do tema", choices: [{ value: "inter" }, { value: "fraunces" }] });
    expect(toSchemaFormValues(OPTION_FIELDS, { gap: 99, density: "compact" })).toMatchObject({ "option.gap": 1, "option.density": "compact" });
  });
});
