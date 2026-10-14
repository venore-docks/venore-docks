import semver from "semver";
import { SUPPORTED_THEME_CONTRACT_RANGE } from "@/contexts/themes/contracts/contract-version";
import type { ResolvedThemeDefinition, ThemeRenderDiagnostics } from "@/contexts/themes/contracts/v8";
import { THEME_REGISTRY, type ThemeRegistryEntry } from "@/themes/registry";
import { resolveInheritance } from "./apply-inheritance";
import { normalizeRegistryEntry } from "./normalize-entry";

export const FALLBACK_THEME_KEY = "venore-slime";

export type ResolveThemeDefinitionOptions = {
  // Só checado quando informado (o tema PERSISTIDO como ativo nunca está desabilitado — toggle-
  // theme-enabled impede; seção/galeria informam).
  isEnabled?: (themeKey: string) => boolean;
  registry?: Record<string, ThemeRegistryEntry>;
};
export type ResolvedThemeDefinitionResult = {
  theme: ResolvedThemeDefinition;
  fallback: ThemeRenderDiagnostics["fallback"];
};

function isInSupportedRange(entry: ThemeRegistryEntry): boolean {
  const version = entry.manifest.themeContractVersion;
  return Boolean(semver.valid(version)) && semver.satisfies(version, SUPPORTED_THEME_CONTRACT_RANGE);
}

// Render-time (spec §6 passo 7): registro → faixa de contrato → habilitado → normaliza (adapter ou
// padrões do kit) → herança (W9). Qualquer falha cai no venore-slime com diagnóstico — nunca
// lança por tema ruim. Puro (sem I/O), barato o bastante pra rodar a cada request.
export function resolveThemeDefinition(themeKey: string, options: ResolveThemeDefinitionOptions = {}): ResolvedThemeDefinitionResult {
  const registry = options.registry ?? THEME_REGISTRY;
  const fallbackEntry = registry[FALLBACK_THEME_KEY];
  const slime = () => normalizeRegistryEntry(fallbackEntry);

  const entry = registry[themeKey];
  if (!entry) return { theme: slime(), fallback: { reason: "missing-theme", requestedKey: themeKey } };
  if (!isInSupportedRange(entry)) return { theme: slime(), fallback: { reason: "out-of-range", requestedKey: themeKey } };
  if (themeKey !== FALLBACK_THEME_KEY && options.isEnabled && !options.isEnabled(themeKey)) {
    return { theme: slime(), fallback: { reason: "disabled", requestedKey: themeKey } };
  }

  const normalized = normalizeRegistryEntry(entry);
  const ancestorKeys = normalized.chain.slice(1);
  const ancestors: ResolvedThemeDefinition[] = [];
  for (const key of ancestorKeys) {
    const ancestor = registry[key];
    if (!ancestor || !isInSupportedRange(ancestor)) {
      return { theme: slime(), fallback: { reason: "invalid-chain", requestedKey: themeKey } };
    }
    ancestors.push(normalizeRegistryEntry(ancestor));
  }
  const inherited = resolveInheritance(normalized, ancestors, slime);
  if (inherited.error) return { theme: inherited.theme, fallback: { reason: "invalid-chain", requestedKey: themeKey } };
  return { theme: inherited.theme, fallback: null };
}

// Admin sob v8 (invariante §0.5): cores (data-theme/paleta), marca e o PRESET de layout do kit que o
// tema declara (Aurora: "rail") — regiões/templates/opções/fontes do kit. Layout próprio
// (componente) não vale no admin e cai no topbar. Antes o layout era sempre "topbar" aqui, então
// resolveArrangement nunca via a rail do tema e o /admin trocava o arranjo do site.
export function toKitAdminDefinition(theme: ResolvedThemeDefinition): ResolvedThemeDefinition {
  if (theme.legacyShell) return theme;
  const kit = normalizeRegistryEntry(THEME_REGISTRY[FALLBACK_THEME_KEY]);
  return {
    ...kit,
    key: theme.key,
    chain: theme.chain,
    manifest: theme.manifest,
    colorPalettes: theme.colorPalettes,
    palette: theme.palette,
    layout: typeof theme.layout === "string" ? theme.layout : "topbar",
    layoutDecl: theme.layoutDecl,
  };
}
