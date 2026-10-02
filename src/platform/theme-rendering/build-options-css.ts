import { THEME_COLOR_VALUE_PATTERN, THEME_OPTION_KEY_PATTERN } from "@/contexts/themes/contracts/v8";
import type { ResolvedThemeOptions, ThemeOptionField, ThemeOptionValue } from "@/contexts/themes/contracts/v8";
import { isValidOptionValue, THEME_OPTION_ATTRIBUTE_VALUE_PATTERN, THEME_OPTION_RANGE_UNITS } from "@/platform/theme-engine/theme-options";

export type OptionsCssAndAttrs = { css: string; attributes: Record<string, string> };
export type OptionsCssContext = {
  themeKey: string;
  // Seletor alternativo (galeria, W10: `[data-gallery-root]`…) no lugar de `html[data-theme="k"]`.
  scope?: string;
  // Admin nunca recebe opções do tema (spec §0.5): `"admin"` ⇒ nada de CSS nem atributo.
  area?: "public" | "admin";
};

const THEME_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Escopo vem de código do core (não de usuário), mas mesmo assim não pode fechar a regra nem abrir
// outra/at-rule/tag: só caracteres de seletor.
const SAFE_SCOPE_PATTERN = /^[A-Za-z0-9_\-[\]="'.#:() >+~*,^$|]{1,200}$/;
const ALLOWED_UNITS = new Set<string>(THEME_OPTION_RANGE_UNITS);

// Número → literal CSS sem notação exponencial (1e-7 não é CSS válido) nem lixo de float.
function cssNumber(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  const text = String(rounded);
  return text.includes("e") ? rounded.toFixed(6).replace(/\.?0+$/, "") : text;
}

// Declaração `--opt-<key>:<valor>` só para valor que passa na whitelist do tipo: range = número
// finito dentro de min/max/step + unidade da lista; color = hex ou oklch estrito. Nada de texto
// livre chega ao CSS (text/media/font não emitem var).
function declaration(field: ThemeOptionField, value: ThemeOptionValue): string | null {
  if (value === null || !isValidOptionValue(field, value)) return null;
  if (field.type === "range" && typeof value === "number" && ALLOWED_UNITS.has(field.unit)) {
    return `--opt-${field.key}:${cssNumber(value)}${field.unit};`;
  }
  if (field.type === "color" && typeof value === "string" && THEME_COLOR_VALUE_PATTERN.test(value)) {
    return `--opt-${field.key}:${value.toLowerCase()};`;
  }
  return null;
}

// Atributo `data-opt-<key>`: boolean ⇒ "true"/"false"; select ⇒ a escolha declarada, só se for
// [a-z0-9-] (o valor vira seletor `[data-opt-k="v"]` no theme.css e é espelhado pelo
// ThemeDomSync) — qualquer outra coisa não vira atributo.
function attribute(field: ThemeOptionField, value: ThemeOptionValue): string | null {
  if (value === null || !isValidOptionValue(field, value)) return null;
  if (field.type === "boolean" && typeof value === "boolean") return value ? "true" : "false";
  if (field.type === "select" && typeof value === "string" && THEME_OPTION_ATTRIBUTE_VALUE_PATTERN.test(value)) return value;
  return null;
}

// select/boolean → atributo `data-opt-<key>` no <html>; range/color → `--opt-<key>` validada no CSS
// de runtime (spec §2.3). Valor de design continua no theme.css do tema
// (`[data-theme="k"][data-opt-density="compact"] { … }`). `scope` troca o seletor (galeria, W10).
export function buildOptionsCssAndAttrs(
  fields: readonly ThemeOptionField[],
  options: ResolvedThemeOptions,
  context: OptionsCssContext,
): OptionsCssAndAttrs {
  if (context.area === "admin") return { css: "", attributes: {} };

  const attributes: Record<string, string> = {};
  const declarations: string[] = [];
  for (const field of fields) {
    if (!THEME_OPTION_KEY_PATTERN.test(field.key)) continue;
    const value = options.values[field.key] ?? null;
    const attr = attribute(field, value);
    if (attr !== null) attributes[`data-opt-${field.key}`] = attr;
    const decl = declaration(field, value);
    if (decl !== null) declarations.push(decl);
  }

  if (declarations.length === 0) return { css: "", attributes };
  const selector =
    context.scope !== undefined
      ? SAFE_SCOPE_PATTERN.test(context.scope)
        ? context.scope
        : null
      : THEME_KEY_PATTERN.test(context.themeKey)
        ? `html[data-theme="${context.themeKey}"]`
        : null;
  return { css: selector ? `${selector}{${declarations.join("")}}` : "", attributes };
}
