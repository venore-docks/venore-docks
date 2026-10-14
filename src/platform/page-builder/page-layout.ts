import { cache } from "react";
import { getCachedCategoryBySlug, getCachedPublishedEntryBySlug } from "@/contexts/cms";
import { readEntryPageLayout, type PageLayout } from "@/contexts/cms/contracts/page-layout";
import {
  DEFAULT_PAGE_LAYOUT,
  type ResolvedPageLayout,
  type ResolvedThemeDefinition,
  type ThemeSectionOverride,
} from "@/contexts/themes/contracts/v8";
import { PAGE_WIDTHS } from "@/contexts/themes/contracts/v8/enums";

// Entry reservada da home (mesmo slug de app/(platform)/page.tsx).
const HOME_ENTRY_SLUG = "home";
// Prefixos que nunca são conteúdo do CMS (admin não tem layout por página; ext/api não passam
// pelo (platform)/layout).
const NON_CMS_PREFIXES = ["admin", "ext", "api"];

function segmentsOf(pathname: string): string[] {
  return pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

// Layout guardado na entry publicada do caminho — pelas MESMAS funções cache() que a página do
// catch-all e o breadcrumb chamam com os MESMOS argumentos (cms/breadcrumbs.ts), então não há
// query nova no request: a categoria/entry já são buscadas pra montar a trilha e a página.
async function entryLayoutForPath(pathname: string | null): Promise<PageLayout> {
  if (pathname === null) return {};
  const segments = segmentsOf(pathname);
  if (segments.length === 0) {
    const home = await getCachedPublishedEntryBySlug(null, HOME_ENTRY_SLUG);
    return home.success && home.data ? readEntryPageLayout(home.data.data) : {};
  }
  if (segments.length > 2 || NON_CMS_PREFIXES.includes(segments[0])) return {};

  const category = await getCachedCategoryBySlug(segments[0]);
  const categoryRow = category.success ? category.data : null;
  if (segments.length === 1) {
    // Categoria tem precedência sobre entry raiz de mesmo slug (BL1): página de categoria não tem
    // layout por entry.
    if (categoryRow) return {};
    const entry = await getCachedPublishedEntryBySlug(null, segments[0]);
    return entry.success && entry.data ? readEntryPageLayout(entry.data.data) : {};
  }
  if (!categoryRow) return {};
  const entry = await getCachedPublishedEntryBySlug(categoryRow.id, segments[1]);
  return entry.success && entry.data ? readEntryPageLayout(entry.data.data) : {};
}

// Valor de seção vem do theme.config (validado na escrita por W6); a leitura ainda filtra, pra um
// documento antigo/estranho nunca produzir um layout fora do vocabulário.
function sectionPage(section: ThemeSectionOverride | null): Partial<Omit<ResolvedPageLayout, "template">> {
  const page = section?.page;
  if (!page) return {};
  const out: Partial<Omit<ResolvedPageLayout, "template">> = {};
  if (page.width && PAGE_WIDTHS.includes(page.width)) out.width = page.width;
  if (typeof page.showRail === "boolean") out.showRail = page.showRail;
  if (page.contextualPlacement === "side" || page.contextualPlacement === "top" || page.contextualPlacement === "none") {
    out.contextualPlacement = page.contextualPlacement;
  }
  return out;
}

// Precedência pura (testável sem request): entry → seção → padrão do tema. "auto"/ausente herda.
// A variante de template da entry só vale se o tema a declara pra "entry" (senão: null = padrão).
export function mergePageLayout(
  entry: PageLayout,
  section: ThemeSectionOverride | null,
  theme: Pick<ResolvedThemeDefinition, "templateVariants">,
  base: ResolvedPageLayout = DEFAULT_PAGE_LAYOUT,
): ResolvedPageLayout {
  const fromSection = sectionPage(section);
  const declaredTemplates = theme.templateVariants.entry ?? [];
  const template =
    entry.template && declaredTemplates.some((variant) => variant.value === entry.template)
      ? entry.template
      : (section?.templates?.entry ?? base.template);
  return {
    width: entry.width ?? fromSection.width ?? base.width,
    showRail: entry.rail === "hidden" ? false : (fromSection.showRail ?? base.showRail),
    contextualPlacement:
      entry.contextualBar && entry.contextualBar !== "auto"
        ? entry.contextualBar
        : (fromSection.contextualPlacement ?? base.contextualPlacement),
    template,
  };
}

const resolvePageLayoutCached = cache(
  async (pathname: string | null, theme: ResolvedThemeDefinition, section: ThemeSectionOverride | null): Promise<ResolvedPageLayout> => {
    // Admin nunca é tematizado (invariante §0.5): layout de página fixo.
    if (pathname === "/admin" || pathname?.startsWith("/admin/")) return DEFAULT_PAGE_LAYOUT;
    let entry: PageLayout = {};
    try {
      entry = await entryLayoutForPath(pathname);
    } catch {
      // Falha de leitura do CMS nunca derruba o layout: a página em si trata o próprio erro.
      entry = {};
    }
    return mergePageLayout(entry, section, theme);
  },
);

// Layout da página (largura, rail, barra contextual, variante de template) — precedência entry →
// seção → padrão do tema (spec §7.15). Chamado pelo render-model do (platform)/layout; a página
// emite os mesmos valores como marcadores data-page-* (PageLayoutMarker) pra o CSS de
// page-layout.css corrigir a navegação soft, em que o layout não re-renderiza.
export async function resolvePageLayout(
  pathname: string | null,
  theme: ResolvedThemeDefinition,
  section: ThemeSectionOverride | null,
): Promise<ResolvedPageLayout> {
  return resolvePageLayoutCached(pathname, theme, section);
}

// Atributos dos marcadores (page-layout.css casa estes seletores via :has()).
export function pageLayoutMarkerAttributes(layout: ResolvedPageLayout): Record<string, string> {
  return {
    "data-page-layout": "",
    "data-page-width": layout.width,
    "data-page-rail": layout.showRail ? "shown" : "hidden",
    "data-page-contextual": layout.contextualPlacement,
  };
}
