import type { ComponentType } from "react";
import type { ThemeBlockRendererProps, ThemeBlockRenderers } from "@/contexts/themes/contracts/v8";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";

export { availableSectionStyles, resolveSectionStyle } from "./with-theme-presentation-fields";

// Renderers de bloco do tema por (bloco, variante), memoizados por theme key por processo e
// SEPARADOS do cachedRenderers do core (block-renderers.tsx) — spec §7.15. O tema declara
// `blockRenderers: () => import("./blocks")` (preguiçoso, server-only): nada do tema entra no
// grafo de quem não renderiza blocos, e um tema sem variantes não custa import nenhum.
const cachedThemeRenderers = new Map<string, Promise<ThemeBlockRenderers>>();

const EMPTY: ThemeBlockRenderers = Object.freeze({});

function isComponent(value: unknown): value is ComponentType<ThemeBlockRendererProps> {
  return typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value);
}

// Só o que tem forma de mapa bloco → variante → componente sobrevive; "default" nunca é variante
// do tema (é o renderer do core).
function sanitize(raw: unknown): ThemeBlockRenderers {
  if (typeof raw !== "object" || raw === null) return EMPTY;
  const out: Record<string, Record<string, ComponentType<ThemeBlockRendererProps>>> = {};
  for (const [blockKey, variants] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof variants !== "object" || variants === null) continue;
    const kept: Record<string, ComponentType<ThemeBlockRendererProps>> = {};
    for (const [variant, component] of Object.entries(variants as Record<string, unknown>)) {
      if (variant !== "default" && isComponent(component)) kept[variant] = component;
    }
    if (Object.keys(kept).length > 0) out[blockKey] = kept;
  }
  return out;
}

async function load(themeKey: string): Promise<ThemeBlockRenderers> {
  const { theme, fallback } = resolveThemeDefinition(themeKey);
  // Tema ausente/fora do contrato caiu no fallback: os renderers dele não valem pra esta key.
  if (fallback && theme.key !== themeKey) return EMPTY;
  return sanitize(await theme.blockRenderers());
}

export function loadThemeBlockRenderers(themeKey?: string): Promise<ThemeBlockRenderers> {
  if (!themeKey) return Promise.resolve(EMPTY);
  let pending = cachedThemeRenderers.get(themeKey);
  if (!pending) {
    pending = load(themeKey).catch((error: unknown) => {
      // Loader do tema quebrado: blocos caem no core; não memoiza a falha (próximo request tenta).
      cachedThemeRenderers.delete(themeKey);
      if (process.env.NODE_ENV !== "production") console.warn(`[theme-block-renderers] ${themeKey}:`, error);
      return EMPTY;
    });
    cachedThemeRenderers.set(themeKey, pending);
  }
  return pending;
}

// Só para testes: zera a memoização por processo.
export function resetThemeBlockRenderersCacheForTests(): void {
  cachedThemeRenderers.clear();
}
