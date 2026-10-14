import { createElement, type ComponentType } from "react";
import {
  THEME_REGION_KEYS,
  type ResolvedThemeDefinition,
  type ThemeBlockRenderers,
  type ThemeDefinition,
  type ThemeLayoutDeclaration,
  type ThemeMessages,
  type ThemeOptionField,
  type ThemePageBuilderDeclaration,
  type ThemeRegionKey,
  type ThemeRegionOverrides,
  type ThemeStates,
  type ThemeTemplates,
} from "@/contexts/themes/contracts/v8";
import type { ColorPalette, ThemeManifest } from "@/contexts/themes/contracts/types";
import { KIT_STATES } from "@/theme-sdk/kit/states";
import { KIT_TEMPLATES } from "@/theme-sdk/kit/templates";
import { THEME_REGISTRY } from "@/themes/registry";
import { normalizeRegistryEntry, normalizeThemeDefinition } from "./normalize-entry";

// Herança entre temas (spec §7.1, dono W9). Puro, sem I/O. `theme` é o filho normalizado sozinho;
// `ancestors` vem na ordem [pai, avô] (cada um normalizado sozinho, como resolveThemeDefinition
// faz). A mescla dobra da raiz pro filho: merge(merge(avô, pai), filho) — cada camada aplica a
// tabela de §7.1 sobre o resultado já herdado da camada de cima.
//
// O CSS não passa por aqui: a herança de tokens é a lineage gerada (scripts/theme-lineage.ts,
// spec §3.1) — `<html data-theme>` continua com UMA chave (a do filho).

export const MAX_THEME_CHAIN_DEPTH = 3;

export type InheritanceChainError =
  | { code: "depth"; chain: readonly string[] }
  | { code: "cycle"; chain: readonly string[] }
  | { code: "mismatch"; chain: readonly string[]; expected: string; received: string | null }
  | { code: "legacy-parent"; chain: readonly string[]; legacyKey: string; offender: string };

export type InheritanceResult = { theme: ResolvedThemeDefinition; error: InheritanceChainError | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;
type TemplateKey = keyof typeof KIT_TEMPLATES;
type ServerStateKey = keyof typeof KIT_STATES;

// --- validação da cadeia ---------------------------------------------------------------------

// O que torna um tema "estrutural" (spec §7.1: pai 7.x só é aceito quando o filho não declara
// layout, regiões nem templates — senão não há Shell inteiro pra herdar).
function declaresStructure(theme: ResolvedThemeDefinition): boolean {
  return (
    declaresLayout(theme) ||
    theme.replacedRegions.length > 0 ||
    (Object.keys(KIT_TEMPLATES) as TemplateKey[]).some((key) => Object.keys(declaredTemplateVariants(theme, key)).length > 0)
  );
}

export function checkInheritanceChain(
  theme: ResolvedThemeDefinition,
  ancestors: readonly ResolvedThemeDefinition[],
): InheritanceChainError | null {
  const chain = theme.chain;
  if (new Set(chain).size !== chain.length) return { code: "cycle", chain };
  if (chain.length > MAX_THEME_CHAIN_DEPTH) return { code: "depth", chain };
  if (chain[0] !== theme.key) return { code: "mismatch", chain, expected: theme.key, received: chain[0] ?? null };
  if (ancestors.length !== chain.length - 1) {
    return { code: "mismatch", chain, expected: chain.slice(1).join(","), received: ancestors.map((a) => a.key).join(",") };
  }
  for (const [index, ancestor] of ancestors.entries()) {
    const expected = chain[index + 1];
    if (ancestor.key !== expected) return { code: "mismatch", chain, expected, received: ancestor.key };
    // A lineage do ancestral (do codegen) precisa ser o resto da cadeia do filho.
    const ancestorChain = ancestor.chain.join(">");
    if (ancestorChain !== chain.slice(index + 1).join(">")) {
      return { code: "mismatch", chain, expected: chain.slice(index + 1).join(">"), received: ancestorChain };
    }
  }
  // Ancestral 7.x: só pode ser a raiz e ninguém abaixo dele pode declarar estrutura.
  const legacyIndex = ancestors.findIndex((ancestor) => ancestor.contract === 7 || ancestor.legacyShell !== null);
  if (legacyIndex >= 0) {
    const legacy = ancestors[legacyIndex];
    if (legacyIndex !== ancestors.length - 1) {
      return { code: "legacy-parent", chain, legacyKey: legacy.key, offender: ancestors[legacyIndex + 1].key };
    }
    const offender = [theme, ...ancestors.slice(0, legacyIndex)].find(declaresStructure);
    if (offender) return { code: "legacy-parent", chain, legacyKey: legacy.key, offender: offender.key };
  }
  return null;
}

// --- regras por camada -----------------------------------------------------------------------

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

function shallow<T extends object>(parent: T | undefined, child: T | undefined): T | undefined {
  if (!parent && !child) return undefined;
  return { ...parent, ...child } as T;
}

function unionList<T>(parent: readonly T[] | undefined, child: readonly T[] | undefined): readonly T[] | undefined {
  if (!parent && !child) return undefined;
  return [...new Set([...(parent ?? []), ...(child ?? [])])];
}

// "Unioned by value, child winning on labels": ordem do pai preservada, itens novos do filho no fim.
function unionByValue<T extends { value: string }>(parent: readonly T[] | undefined, child: readonly T[] | undefined): readonly T[] | undefined {
  if (!parent && !child) return undefined;
  const merged = new Map<string, T>();
  for (const item of parent ?? []) merged.set(item.value, item);
  for (const item of child ?? []) merged.set(item.value, { ...merged.get(item.value), ...item });
  return [...merged.values()];
}

function unionRecordByValue<K extends string, T extends { value: string }>(
  parent: Partial<Record<K, readonly T[]>> | undefined,
  child: Partial<Record<K, readonly T[]>> | undefined,
): Partial<Record<K, readonly T[]>> | undefined {
  if (!parent && !child) return undefined;
  const keys = new Set([...Object.keys(parent ?? {}), ...Object.keys(child ?? {})]) as Set<K>;
  return Object.fromEntries([...keys].map((key) => [key, unionByValue(parent?.[key], child?.[key]) ?? []])) as Partial<Record<K, readonly T[]>>;
}

// Opções: por chave. O filho muda default, label, choices (etc.) mas nunca o tipo — redeclarar com
// outro tipo é ignorado (vale o campo do pai). Chave nova do filho entra no fim.
export function mergeOptionFields(
  parent: readonly ThemeOptionField[] | undefined,
  child: readonly ThemeOptionField[] | undefined,
): readonly ThemeOptionField[] | undefined {
  if (!parent && !child) return undefined;
  const merged = new Map<string, ThemeOptionField>();
  for (const field of parent ?? []) merged.set(field.key, field);
  for (const field of child ?? []) {
    const inherited = merged.get(field.key);
    if (!inherited) merged.set(field.key, field);
    else if (inherited.type === field.type) merged.set(field.key, { ...inherited, ...field } as ThemeOptionField);
  }
  return [...merged.values()];
}

// removeOptions acumula na cadeia (W2 lê `manifest.removeOptions` pra marcar valor guardado como
// `removed`), exceto chave que o próprio filho volta a declarar.
function mergeRemoveOptions(parent: ThemeManifest, child: ThemeManifest): readonly string[] | undefined {
  const redeclared = new Set((child.options ?? []).map((field) => field.key));
  const inherited = (parent.removeOptions ?? []).filter((key) => !redeclared.has(key));
  return unionList(inherited.length > 0 ? inherited : undefined, child.removeOptions);
}

function mergePageBuilder(
  parent: ThemePageBuilderDeclaration | undefined,
  child: ThemePageBuilderDeclaration | undefined,
): ThemePageBuilderDeclaration | undefined {
  if (!parent && !child) return undefined;
  return defined({
    blockVariants: unionRecordByValue(parent?.blockVariants, child?.blockVariants) as ThemePageBuilderDeclaration["blockVariants"],
    sectionStyles: unionByValue(parent?.sectionStyles, child?.sectionStyles),
    hideSectionStyles: unionList(parent?.hideSectionStyles, child?.hideSectionStyles),
  });
}

function mergeFonts(parent: ThemeManifest["fonts"], child: ThemeManifest["fonts"]): ThemeManifest["fonts"] {
  if (!parent && !child) return undefined;
  const choices = shallow(parent?.choices, child?.choices);
  return defined({ ...parent, ...child, choices });
}

// Manifesto efetivo: identidade (key, name, version, contrato, brandAesthetics…) é do filho; os
// campos v8 seguem a tabela de §7.1. `layout` é mesclado aqui (e não só em layoutDecl) porque W3
// lê `manifest.layout?.<campo>` pra distinguir valor declarado de default do preset.
export function mergeManifests(parent: ThemeManifest, child: ThemeManifest): ThemeManifest {
  return defined({
    ...child,
    layout: shallow<ThemeLayoutDeclaration>(parent.layout, child.layout),
    responsive: shallow(parent.responsive, child.responsive),
    options: mergeOptionFields(parent.options, child.options),
    removeOptions: mergeRemoveOptions(parent, child),
    palette: shallow(parent.palette, child.palette),
    fonts: mergeFonts(parent.fonts, child.fonts),
    pageBuilder: mergePageBuilder(parent.pageBuilder, child.pageBuilder),
    templateVariants: unionRecordByValue(parent.templateVariants, child.templateVariants),
    outlets: unionList(parent.outlets, child.outlets),
    seo: shallow(parent.seo, child.seo),
    locales: unionList(parent.locales, child.locales),
    budgets: shallow(parent.budgets, child.budgets),
  });
}

export function mergeMessages(parent: ThemeMessages, child: ThemeMessages): ThemeMessages {
  const locales = new Set([...Object.keys(parent), ...Object.keys(child)]);
  return Object.fromEntries([...locales].map((locale) => [locale, { ...parent[locale], ...child[locale] }]));
}

export function mergeColorPalettes(parent: readonly ColorPalette[], child: readonly ColorPalette[]): ColorPalette[] {
  const ids = new Set(child.map((palette) => palette.id));
  return [...child, ...parent.filter((palette) => !ids.has(palette.id))];
}

// blockRenderers: os dois loaders continuam lazy; o mapa do filho vence por chave de bloco E por
// variante (as variantes do pai que o filho não redeclara continuam valendo).
export function composeBlockRenderers(
  parent: () => Promise<ThemeBlockRenderers>,
  child: () => Promise<ThemeBlockRenderers>,
): () => Promise<ThemeBlockRenderers> {
  return async () => {
    const [inherited, own] = await Promise.all([parent(), child()]);
    const keys = new Set([...Object.keys(inherited), ...Object.keys(own)]);
    return Object.fromEntries([...keys].map((key) => [key, { ...inherited[key], ...own[key] }]));
  };
}

// Região substituída pelos dois: o override do filho recebe como `Default` o override do pai já
// ligado ao Default do kit (o que o ThemeRenderer passa). O componente ligado é memoizado por
// Default — identidade estável entre renders, sem remontar a subárvore.
type RegionComponent = ComponentType<Record<string, unknown> & { Default: AnyComponent }>;

export function inheritRegion(child: AnyComponent, parent: AnyComponent): AnyComponent {
  const Child = child as RegionComponent;
  const Parent = parent as RegionComponent;
  const bound = new WeakMap<AnyComponent, AnyComponent>();
  function InheritedRegion({ Default, ...props }: Record<string, unknown> & { Default: AnyComponent }) {
    let ParentWithDefault = bound.get(Default);
    if (!ParentWithDefault) {
      const Kit = Default;
      const ParentRegion = (parentProps: Record<string, unknown>) => createElement(Parent, { ...parentProps, Default: Kit });
      ParentRegion.displayName = `Inherited(${Parent.displayName ?? Parent.name ?? "Region"})`;
      bound.set(Default, ParentRegion);
      ParentWithDefault = ParentRegion;
    }
    return createElement(Child, { ...props, Default: ParentWithDefault });
  }
  InheritedRegion.displayName = `InheritedRegion(${Child.displayName ?? Child.name ?? "Region"})`;
  return InheritedRegion;
}

function mergeRegions(parent: ResolvedThemeDefinition, child: ResolvedThemeDefinition): ThemeRegionOverrides {
  const replaced = new Set<ThemeRegionKey>([...parent.replacedRegions, ...child.replacedRegions]);
  const own = new Set(child.replacedRegions);
  const inherited = new Set(parent.replacedRegions);
  return Object.fromEntries(
    THEME_REGION_KEYS.filter((key) => replaced.has(key)).map((key) => {
      const childRegion = child.regions[key] as AnyComponent;
      const parentRegion = parent.regions[key] as AnyComponent;
      if (own.has(key) && inherited.has(key)) return [key, inheritRegion(childRegion, parentRegion)];
      return [key, own.has(key) ? childRegion : parentRegion];
    }),
  ) as ThemeRegionOverrides;
}

// Variantes que o tema REALMENTE declarou (o normalizador preenche "default" com o kit).
function declaredTemplateVariants(theme: ResolvedThemeDefinition, key: TemplateKey): Record<string, AnyComponent> {
  const variants = theme.templates[key] as Record<string, AnyComponent>;
  const kit = KIT_TEMPLATES[key] as AnyComponent;
  return Object.fromEntries(Object.entries(variants).filter(([, component]) => component !== kit));
}

// Templates: o filho vence por chave E por variante; variantes do pai que o filho não redeclara
// continuam disponíveis.
function mergeTemplates(parent: ResolvedThemeDefinition, child: ResolvedThemeDefinition): ThemeTemplates {
  return Object.fromEntries(
    (Object.keys(KIT_TEMPLATES) as TemplateKey[]).flatMap((key) => {
      const merged = { ...declaredTemplateVariants(parent, key), ...declaredTemplateVariants(child, key) };
      return Object.keys(merged).length > 0 ? [[key, merged]] : [];
    }),
  ) as ThemeTemplates;
}

function mergeStates(parent: ResolvedThemeDefinition, child: ResolvedThemeDefinition): ThemeStates {
  return Object.fromEntries(
    (Object.keys(KIT_STATES) as ServerStateKey[]).flatMap((key) => {
      if (child.states[key] !== KIT_STATES[key]) return [[key, child.states[key]]];
      if (parent.states[key] !== KIT_STATES[key]) return [[key, parent.states[key]]];
      return [];
    }),
  ) as ThemeStates;
}

// layout é "declarado" quando é componente, quando o manifesto fixa o preset ou quando difere do
// default do normalizador ("topbar"). `layout: "topbar"` sem manifesto não se distingue do default
// e herda do pai — declare `manifest.layout.preset` pra fixar.
function declaresLayout(theme: ResolvedThemeDefinition): boolean {
  return typeof theme.layout === "function" || theme.manifest.layout?.preset !== undefined || theme.layout !== "topbar";
}

function mergeTwo(parent: ResolvedThemeDefinition, child: ResolvedThemeDefinition): ResolvedThemeDefinition {
  const manifest = mergeManifests(parent.manifest, child.manifest);
  const definition: ThemeDefinition = {
    manifest,
    layout: declaresLayout(child) ? child.layout : parent.layout,
    regions: mergeRegions(parent, child),
    templates: mergeTemplates(parent, child),
    states: mergeStates(parent, child),
    blockRenderers: composeBlockRenderers(parent.blockRenderers, child.blockRenderers),
    messages: mergeMessages(parent.messages, child.messages),
    assets: { ...parent.assets, ...child.assets },
    colorPalettes: mergeColorPalettes(parent.colorPalettes, child.colorPalettes),
  };
  // O normalizador recalcula os derivados (layoutDecl, opções filtradas por removeOptions, fontes,
  // orçamentos, outletsRendered) a partir do manifesto e da definição já mesclados.
  const merged = normalizeThemeDefinition(child.key, definition, child.chain);
  if (!parent.legacyShell) return merged;
  // Pai 7.x (só raiz, filho sem estrutura — checkInheritanceChain garante): Shell inteiro do pai,
  // tokens/paletas/mensagens do filho por cima. Mesmo recorte de normalizeRegistryEntry pro 7.x.
  return { ...merged, contract: 7, legacyShell: parent.legacyShell, options: [], outletsRendered: parent.outletsRendered };
}

// Versão com diagnóstico: cadeia inválida (ciclo, profundidade > 3, ancestrais que não batem com
// a lineage, pai 7.x com filho estrutural) devolve o venore-slime e o erro — nunca uma mescla
// parcial.
export function resolveInheritance(
  theme: ResolvedThemeDefinition,
  ancestors: readonly ResolvedThemeDefinition[],
  fallback: () => ResolvedThemeDefinition = slimeFallback,
): InheritanceResult {
  if (theme.chain.length <= 1 && ancestors.length === 0) return { theme, error: null };
  const error = checkInheritanceChain(theme, ancestors);
  if (error) return { theme: fallback(), error };
  const fromRoot = [...ancestors].reverse();
  const inherited = fromRoot.slice(1).reduce((acc, ancestor) => mergeTwo(acc, ancestor), fromRoot[0]);
  return { theme: mergeTwo(inherited, theme), error: null };
}

function slimeFallback(): ResolvedThemeDefinition {
  return normalizeRegistryEntry(THEME_REGISTRY["venore-slime"]);
}

// Ponto chamado por resolveThemeDefinition (F). Mesma semântica de resolveInheritance sem o
// diagnóstico — a cadeia vinda do codegen já é validada lá (ciclo/profundidade/pai ausente), então
// o fallback aqui só cobre registro montado à mão.
export function applyInheritance(
  theme: ResolvedThemeDefinition,
  ancestors: readonly ResolvedThemeDefinition[],
): ResolvedThemeDefinition {
  return resolveInheritance(theme, ancestors).theme;
}
