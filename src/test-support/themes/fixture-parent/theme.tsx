import type {
  EntryTemplateProps,
  FooterRegionProps,
  HeaderRegionProps,
  HomeTemplateProps,
  PageStateProps,
  ThemeBlockRendererProps,
} from "@/contexts/themes/contracts/v8";
import { defineTheme } from "@/theme-sdk/define";
import type { ComponentType } from "react";

// Fixture de herança (W9, spec §7.1/§12): pai v8 que estende o venore-slime e declara um pouco de
// cada camada da tabela de merge. O theme.css ao lado só tem diffs sobre o slime.

type WithDefault<P> = P & { Default: ComponentType<P> };

export function ParentHeader({ Default, ...props }: WithDefault<HeaderRegionProps>) {
  return (
    <div data-fixture="parent-header">
      <Default {...props} />
    </div>
  );
}

export function ParentFooter({ Default, ...props }: WithDefault<FooterRegionProps>) {
  return (
    <div data-fixture="parent-footer">
      <Default {...props} />
    </div>
  );
}

export function ParentEntry({ entry }: EntryTemplateProps) {
  return <article data-fixture="parent-entry">{entry.title}</article>;
}
export function ParentEntryWide({ entry }: EntryTemplateProps) {
  return <article data-fixture="parent-entry-wide">{entry.title}</article>;
}
export function ParentHome(props: HomeTemplateProps) {
  return <main data-fixture="parent-home">{props.content}</main>;
}
export function ParentEmptyState({ title }: PageStateProps) {
  return <p data-fixture="parent-empty">{title}</p>;
}
export function ParentHero(props: ThemeBlockRendererProps) {
  return <section data-fixture="parent-hero">{props.variant}</section>;
}
export function ParentHeroSplit(props: ThemeBlockRendererProps) {
  return <section data-fixture="parent-hero-split">{props.variant}</section>;
}

export const fixtureParentTheme = defineTheme({
  manifest: {
    key: "fixture-parent",
    name: "Fixture Parent",
    version: "1.0.0",
    themeContractVersion: "8.0.0",
    brandAesthetics: { mode: "svg", size: 100, scrolledSize: 90, position: "left", color: "#7a2e12" },
    colorModes: ["light", "dark"],
    extends: "venore-slime",
    layout: { preset: "rail", collapseControl: "header", headerNavVisibleFrom: "lg" },
    responsive: { mobileNav: "bottom-bar", contextualBarMobile: "hidden" },
    options: [
      {
        key: "density",
        type: "select",
        label: "Densidade",
        default: "comfortable",
        choices: [
          { value: "comfortable", label: "Confortável" },
          { value: "compact", label: "Compacta" },
        ],
      },
      { key: "show-tagline", type: "boolean", label: "Mostrar slogan", default: true },
      { key: "hero-height", type: "range", label: "Altura do hero", default: 24, min: 16, max: 40, step: 2, unit: "rem" },
    ],
    palette: { accent: "complement", allowCustom: false, lockedTokens: ["--destructive"] },
    fonts: { sans: "inter", choices: { sans: ["inter", "manrope"] } },
    pageBuilder: {
      sectionStyles: [{ value: "spotlight", label: "Destaque" }],
      blockVariants: { hero: [{ value: "split", label: "Dividido" }] },
      hideSectionStyles: ["accent"],
    },
    templateVariants: { entry: [{ value: "wide", label: "Larga" }] },
    outlets: ["header.end"],
    seo: { themeColor: "from-tokens", structuredData: { entry: "Article" } },
    locales: ["pt-BR"],
    budgets: { cssGzipBytes: 4_096 },
  },
  regions: { header: ParentHeader, footer: ParentFooter },
  templates: { entry: { default: ParentEntry, wide: ParentEntryWide }, home: ParentHome },
  states: { empty: ParentEmptyState },
  blockRenderers: async () => ({ hero: { default: ParentHero, split: ParentHeroSplit } }),
  messages: {
    "pt-BR": { "fixture.greeting": "Olá do pai", "fixture.parent-only": "só no pai" },
    en: { "fixture.greeting": "Hello from parent" },
  },
  colorPalettes: [
    { id: "ember", name: "Brasa", light: { primary: "oklch(0.6 0.2 30)" }, dark: { primary: "oklch(0.7 0.18 30)" } },
    { id: "shared", name: "Compartilhada (pai)", light: { primary: "oklch(0.5 0.1 200)" }, dark: {} },
  ],
});
