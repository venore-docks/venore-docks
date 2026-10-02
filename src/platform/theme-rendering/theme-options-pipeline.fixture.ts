import type { ResolvedThemeDefinition, ThemeOptionField } from "@/contexts/themes/contracts/v8";

export const OPTION_FIELDS: ThemeOptionField[] = [
  { key: "density", label: "Densidade", type: "select", default: "comfortable", choices: [{ value: "comfortable", label: "Confortável" }, { value: "compact", label: "Compacta" }] },
  { key: "rounded", label: "Arredondado", type: "boolean", default: true },
  { key: "gap", label: "Espaço", type: "range", default: 1, min: 0, max: 2, step: 0.25, unit: "rem" },
  { key: "brand", label: "Cor", type: "color", default: "#112233" },
  { key: "tagline", label: "Slogan", type: "text", default: "oi", maxLength: 10 },
  { key: "logo", label: "Logo", type: "media", accept: "image" },
  { key: "display", label: "Fonte", type: "font", role: "display" },
];

export function themeWithOptions(options: ThemeOptionField[] = OPTION_FIELDS, extra: Partial<ResolvedThemeDefinition> = {}): ResolvedThemeDefinition {
  return {
    key: "aurora",
    options,
    manifest: { removeOptions: ["old"] },
    layoutDecl: { presetChoices: ["topbar", "rail"] },
    responsive: { mobileNavChoices: ["drawer"] },
    ...extra,
  } as unknown as ResolvedThemeDefinition;
}
