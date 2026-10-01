import type { ComponentType } from "react";
import {
  DEFAULT_THEME_BUDGETS,
  LEGACY_THEME_OUTLETS,
  THEME_OUTLET_NAMES,
  THEME_REGION_KEYS,
  type ResolvedThemeDefinition,
  type ThemeDefinition,
  type ThemeLayoutPreset,
  type ThemeRegionKey,
  type ThemeRegionOverrides,
  type ThemeTemplates,
} from "@/contexts/themes/contracts/v8";
import { KIT_STATES } from "@/theme-sdk/kit/states";
import { KIT_TEMPLATES } from "@/theme-sdk/kit/templates";
import type { ThemeRegistryEntry } from "@/themes/registry";

// Normaliza uma entrada do registro numa definição completa (spec §2.12): todo campo ausente cai
// no kit (= o venore-slime de hoje). Tema 7.x vira `legacyShell` (adapter) com kit em todo o
// resto. Puro, sem I/O. Dono: Fase F.

// Região não substituída: o "override" é só o Default — o ThemeRenderer nem usa (renderiza o kit
// direto), mas o tipo Required<> fica completo pra quem compõe (herança, W9).
function passthrough<P>(): ComponentType<P & { Default: ComponentType<P> }> {
  function KitRegionPassthrough({ Default, ...props }: P & { Default: ComponentType<P> }) {
    return <Default {...(props as P & object)} />;
  }
  return KitRegionPassthrough as ComponentType<P & { Default: ComponentType<P> }>;
}

function normalizeRegions(regions: ThemeRegionOverrides | undefined): {
  regions: Required<ThemeRegionOverrides>;
  replaced: ThemeRegionKey[];
} {
  const replaced = THEME_REGION_KEYS.filter((key) => typeof regions?.[key] === "function");
  const full = Object.fromEntries(
    THEME_REGION_KEYS.map((key) => [key, regions?.[key] ?? passthrough()]),
  ) as unknown as Required<ThemeRegionOverrides>;
  return { regions: full, replaced };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

function normalizeTemplates(templates: ThemeTemplates | undefined): ResolvedThemeDefinition["templates"] {
  const keys = Object.keys(KIT_TEMPLATES) as (keyof typeof KIT_TEMPLATES)[];
  return Object.fromEntries(
    keys.map((key) => {
      const declared = templates?.[key] as AnyComponent | Readonly<Record<string, AnyComponent>> | undefined;
      const kit = KIT_TEMPLATES[key] as AnyComponent;
      if (!declared) return [key, { default: kit }];
      if (typeof declared === "function") return [key, { default: declared }];
      return [key, { default: kit, ...declared }];
    }),
  ) as unknown as ResolvedThemeDefinition["templates"];
}

const emptyBlockRenderers = async () => ({});

export function normalizeThemeDefinition(key: string, definition: ThemeDefinition, lineage: readonly string[]): ResolvedThemeDefinition {
  const manifest = definition.manifest;
  const { regions, replaced } = normalizeRegions(definition.regions);
  const preset: ThemeLayoutPreset = manifest.layout?.preset && manifest.layout.preset !== "custom" ? manifest.layout.preset : "topbar";
  const removed = new Set(manifest.removeOptions ?? []);

  return {
    key,
    chain: lineage.length > 0 ? lineage : [key],
    contract: 8,
    manifest,
    legacyShell: null,
    layout: definition.layout ?? preset,
    regions,
    replacedRegions: replaced,
    templates: normalizeTemplates(definition.templates),
    states: { ...KIT_STATES, ...definition.states },
    options: (manifest.options ?? []).filter((option) => !removed.has(option.key)),
    responsive: {
      mobileNav: manifest.responsive?.mobileNav ?? "drawer",
      mobileNavChoices: manifest.responsive?.mobileNavChoices ?? [],
      contextualBarMobile: manifest.responsive?.contextualBarMobile ?? "bottom",
    },
    layoutDecl: {
      preset: manifest.layout?.preset ?? preset,
      presetChoices: manifest.layout?.presetChoices ?? [],
      railSide: manifest.layout?.railSide ?? "start",
      collapseControl: manifest.layout?.collapseControl ?? "rail",
      headerNavVisibleFrom: manifest.layout?.headerNavVisibleFrom ?? "always",
    },
    fonts: {
      sans: manifest.fonts?.sans ?? "geist",
      display: manifest.fonts?.display ?? manifest.fonts?.sans ?? "geist",
      mono: manifest.fonts?.mono ?? "geist-mono",
    },
    fontChoices: manifest.fonts?.choices ?? {},
    messages: definition.messages ?? {},
    pageBuilder: {
      blockVariants: manifest.pageBuilder?.blockVariants ?? {},
      sectionStyles: manifest.pageBuilder?.sectionStyles ?? [],
      hideSectionStyles: manifest.pageBuilder?.hideSectionStyles ?? [],
    },
    templateVariants: manifest.templateVariants ?? {},
    palette: manifest.palette ?? {},
    seo: manifest.seo ?? {},
    budgets: { ...DEFAULT_THEME_BUDGETS, ...manifest.budgets },
    assets: definition.assets ?? {},
    blockRenderers: definition.blockRenderers ?? emptyBlockRenderers,
    colorPalettes: definition.colorPalettes ?? [],
    // Regiões do kit renderizam todos os outlets; região custom só os que o manifesto declara.
    outletsRendered: replaced.length === 0 ? THEME_OUTLET_NAMES : (manifest.outlets ?? THEME_OUTLET_NAMES),
  };
}

export function normalizeRegistryEntry(entry: ThemeRegistryEntry): ResolvedThemeDefinition {
  if (entry.contract === 8) {
    return normalizeThemeDefinition(entry.manifest.key, { ...entry.definition, colorPalettes: entry.colorPalettes }, entry.lineage);
  }
  // 7.x (spec §8): Shell inteiro; ganha kit templates/estados, nada de opções/regiões/fontes.
  const base = normalizeThemeDefinition(entry.manifest.key, { manifest: entry.manifest, colorPalettes: entry.colorPalettes }, [
    entry.manifest.key,
  ]);
  return {
    ...base,
    contract: 7,
    legacyShell: entry.Shell,
    options: [],
    outletsRendered: LEGACY_THEME_OUTLETS,
  };
}
