import type {
  CategoryTemplateProps,
  EntryTemplateProps,
  HeaderRegionProps,
  PageStateProps,
  ThemeBlockRendererProps,
} from "@/contexts/themes/contracts/v8";
import { defineTheme } from "@/theme-sdk/define";
import type { ComponentType } from "react";

// Fixture de herança (W9): filho de fixture-parent (cadeia [fixture-child, fixture-parent,
// venore-slime] — profundidade máxima). Só diffs em cada camada; o theme.css ao lado também.

type WithDefault<P> = P & { Default: ComponentType<P> };

export function ChildHeader({ Default, ...props }: WithDefault<HeaderRegionProps>) {
  return (
    <div data-fixture="child-header">
      <Default {...props} />
    </div>
  );
}
export function ChildEntryMagazine({ entry }: EntryTemplateProps) {
  return <article data-fixture="child-entry-magazine">{entry.title}</article>;
}
export function ChildCategory({ category }: CategoryTemplateProps) {
  return <section data-fixture="child-category">{category.label}</section>;
}
export function ChildForbiddenState({ title }: PageStateProps) {
  return <p data-fixture="child-forbidden">{title}</p>;
}
export function ChildHeroSplit(props: ThemeBlockRendererProps) {
  return <section data-fixture="child-hero-split">{props.variant}</section>;
}
export function ChildQuote(props: ThemeBlockRendererProps) {
  return <blockquote data-fixture="child-quote">{props.variant}</blockquote>;
}

export const fixtureChildTheme = defineTheme({
  manifest: {
    key: "fixture-child",
    name: "Fixture Child",
    version: "1.0.0",
    themeContractVersion: "8.0.0",
    brandAesthetics: { mode: "svg", size: 96, scrolledSize: 88, position: "left", color: "#4b1f7a" },
    colorModes: ["light", "dark"],
    extends: "fixture-parent",
    layout: { railSide: "end" },
    responsive: { mobileNav: "drawer" },
    options: [
      // muda default, label e choices (permitido)
      {
        key: "density",
        type: "select",
        label: "Densidade do filho",
        default: "compact",
        choices: [
          { value: "compact", label: "Compacta" },
          { value: "dense", label: "Densa" },
        ],
      },
      // tenta mudar o tipo (range → boolean): ignorado, vale o do pai
      { key: "hero-height", type: "boolean", label: "Hero alto", default: false },
      { key: "tagline", type: "text", label: "Slogan", default: "", maxLength: 80 },
    ],
    removeOptions: ["show-tagline"],
    palette: { allowCustom: true },
    fonts: { display: "fraunces", choices: { display: ["fraunces", "playfair-display"] } },
    pageBuilder: {
      sectionStyles: [
        { value: "spotlight", label: "Holofote" },
        { value: "quiet", label: "Discreta" },
      ],
      blockVariants: { hero: [{ value: "split", label: "Em duas colunas" }], quote: [{ value: "pull", label: "Citação" }] },
      hideSectionStyles: ["inverted"],
    },
    templateVariants: {
      entry: [
        { value: "wide", label: "Bem larga" },
        { value: "magazine", label: "Revista" },
      ],
    },
    outlets: ["header.start"],
    seo: { structuredData: { entry: "BlogPosting" } },
    locales: ["en"],
    budgets: { clientModules: 6 },
  },
  regions: { header: ChildHeader },
  templates: { entry: { magazine: ChildEntryMagazine }, category: ChildCategory },
  states: { forbidden: ChildForbiddenState },
  blockRenderers: async () => ({ hero: { split: ChildHeroSplit }, quote: { default: ChildQuote } }),
  messages: { "pt-BR": { "fixture.greeting": "Olá do filho" }, es: { "fixture.greeting": "Hola" } },
  colorPalettes: [
    { id: "shared", name: "Compartilhada (filho)", light: { primary: "oklch(0.5 0.2 300)" }, dark: {} },
    { id: "violet", name: "Violeta", light: { primary: "oklch(0.55 0.2 300)" }, dark: { primary: "oklch(0.72 0.17 300)" } },
  ],
});
