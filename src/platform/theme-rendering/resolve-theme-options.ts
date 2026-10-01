import type { ResolvedThemeDefinition, ResolvedThemeOptions, ThemeOptionField, ThemeOptionValue } from "@/contexts/themes/contracts/v8";

function defaultValue(field: ThemeOptionField): ThemeOptionValue {
  switch (field.type) {
    case "font":
      return field.default ?? null;
    case "media":
      return null;
    default:
      return field.default;
  }
}

// Valores efetivos das opções do tema (spec §6 passo 8): padrão do manifesto ← valor salvo do
// tema ← override da seção. Dono: W2 (validação por tipo, `ignored`, mídia). Na Fase F: só os
// padrões declarados (nenhum tema declara opções ainda).
export function resolveThemeOptions(
  theme: ResolvedThemeDefinition,
  stored: Readonly<Record<string, ThemeOptionValue>> | undefined,
  sectionOverrides: Readonly<Record<string, ThemeOptionValue>> | undefined,
): ResolvedThemeOptions {
  void stored;
  void sectionOverrides;
  return {
    values: Object.fromEntries(theme.options.map((field) => [field.key, defaultValue(field)])),
    media: {},
    ignored: [],
  };
}
