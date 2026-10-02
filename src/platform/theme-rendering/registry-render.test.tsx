import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_PAGE_LAYOUT, defaultThemeConfigDocument, type ThemeRenderModel } from "@/contexts/themes/contracts/v8";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { BASE_SLOT_FIXTURE } from "@/platform/theme-gallery/fixtures";
import { THEME_REGISTRY } from "@/themes/registry";
import { LegacyShellAdapter } from "./legacy-shell-adapter";
import { resolveThemeDefinition } from "./resolve-theme-definition";
import { ThemeRenderer } from "./theme-renderer";

// Todo tema do registro (slime v8 + os 13 pacotes 7.x via adapter) resolve sem fallback e
// renderiza SSR com as props de slot base — o mínimo que a Fase F garante (o harness completo,
// com cenários e asserções de DOM, é do W10).
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: () => {}, push: () => {} }), useSearchParams: () => new URLSearchParams() }));

function model(themeKey: string): ThemeRenderModel {
  const { theme, fallback } = resolveThemeDefinition(themeKey);
  expect(fallback).toBeNull();
  return {
    pathname: "/",
    area: "public",
    theme,
    config: { ...defaultThemeConfigDocument(themeKey), revisionId: null, publishedAt: null, source: "legacy-synthesis" },
    section: null,
    options: { values: {}, media: {}, ignored: [] },
    fonts: { classNames: "", css: "" },
    locale: "pt-BR",
    dir: "ltr",
    htmlAttributes: {},
    runtimeCss: "",
    override: null,
    diagnostics: { source: "legacy-synthesis", fallback: null, ignoredOptions: [], section: null },
    slotProps: { header: BASE_SLOT_FIXTURE.header, footer: BASE_SLOT_FIXTURE.footer, sidebarLeft: BASE_SLOT_FIXTURE.sidebarLeft },
    breadcrumbs: [{ key: "home", label: "Início", href: "/", current: true }],
    breadcrumbsJsonLd: { "@type": "BreadcrumbList", name: "</script>" },
    contextual: { source: "none" },
    outlets: {},
    strings: KIT_STRINGS_PT_BR,
    page: DEFAULT_PAGE_LAYOUT,
    maintenance: false,
  };
}

describe("registro inteiro renderiza pela v8", () => {
  it.each(Object.keys(THEME_REGISTRY))("%s", (key) => {
    const m = model(key);
    const tree = m.theme.legacyShell ? (
      <LegacyShellAdapter model={m}>
        <p>conteúdo</p>
      </LegacyShellAdapter>
    ) : (
      <ThemeRenderer model={m}>
        <p>conteúdo</p>
      </ThemeRenderer>
    );
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("<p>conteúdo</p>");
    expect(html).toMatch(/<header/);
    expect(html).not.toContain("</script></script>");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(m.theme.contract).toBe(key === "venore-slime" ? 8 : 7);
  });
});
