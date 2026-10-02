import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { DEFAULT_PAGE_LAYOUT, defaultThemeConfigDocument, type ThemeRenderModel } from "@/contexts/themes/contracts/v8";
import type { ThemeManifest } from "@/contexts/themes/contracts/types";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { THEME_REGISTRY } from "@/themes/registry";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";
import { SLIME_PARITY_SCENARIOS } from "@/themes/venore-slime/parity.fixtures";
import { normalizeThemeDefinition } from "./normalize-entry";
import { ThemeRenderer } from "./theme-renderer";

// Layout "rail" do kit x Shell do Aurora 0.1.13 (spec v8 §12, W3): mesmo ARRANJO, comparado por
// estrutura SSR (não por pixel nem por classe de identidade visual — essas continuam do tema):
//   - rail de altura total à esquerda, sticky a partir de lg, irmã da coluna de conteúdo;
//   - header só sobre a coluna da direita, com o botão de colapso dentro dele;
//   - menu do header escondido abaixo de lg e repetido no fim do drawer (lg:hidden);
//   - footer dentro da coluna, depois do <main>.
vi.mock("next/navigation", () => ({ usePathname: () => "/blog" }));

const auroraEntry = THEME_REGISTRY["aurora"];
const scenarioNames = ["anon-public", "logged-in", "admin", "collapsed-static-header"] as const;
const content = <p>Conteúdo da página</p>;

function kitRailModel(name: string): ThemeRenderModel {
  const props = SLIME_PARITY_SCENARIOS.find((candidate) => candidate.name === name)!.props;
  const theme = normalizeThemeDefinition(
    "rail-fixture",
    { ...venoreSlimeTheme, layout: "rail", manifest: { ...venoreSlimeTheme.manifest, key: "rail-fixture" } as ThemeManifest },
    ["rail-fixture"],
  );
  return {
    pathname: "/blog",
    area: "public",
    theme,
    config: { ...defaultThemeConfigDocument("rail-fixture"), revisionId: null, publishedAt: null, source: "legacy-synthesis" },
    section: null,
    options: { values: {}, media: {}, ignored: [] },
    fonts: { classNames: "", css: "" },
    locale: "pt-BR",
    dir: "ltr",
    htmlAttributes: {},
    runtimeCss: "",
    override: null,
    diagnostics: { source: "legacy-synthesis", fallback: null, ignoredOptions: [], section: null },
    slotProps: { header: props.header, footer: props.footer, sidebarLeft: props.sidebarLeft },
    breadcrumbs: props.breadcrumbs,
    breadcrumbsJsonLd: props.breadcrumbsJsonLd,
    contextual: { source: "none" },
    outlets: {},
    strings: KIT_STRINGS_PT_BR,
    page: DEFAULT_PAGE_LAYOUT,
    maintenance: false,
  };
}

const LANDMARKS = new Set(["HEADER", "MAIN", "FOOTER", "ASIDE", "NAV"]);

function isCollapseButton(element: Element) {
  return element.tagName === "BUTTON" && /barra lateral/.test(element.getAttribute("aria-label") ?? "");
}

// Esqueleto: cada landmark (e o botão de colapso), em ordem de documento, com a cadeia de
// landmarks ancestrais. Ignora wrappers sem papel (div), atributos data-* e o skip link.
function skeleton(markup: string): string[] {
  const doc = new JSDOM(`<body>${markup}</body>`).window.document;
  const out: string[] = [];
  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    if (!LANDMARKS.has(element.tagName) && !isCollapseButton(element)) continue;
    const chain: string[] = [];
    for (let node = element.parentElement; node && node !== doc.body; node = node.parentElement) {
      if (LANDMARKS.has(node.tagName)) chain.unshift(node.tagName.toLowerCase());
    }
    chain.push(isCollapseButton(element) ? "button[collapse]" : element.tagName.toLowerCase());
    out.push(chain.join(" > "));
  }
  return out;
}

function traits(markup: string) {
  const doc = new JSDOM(`<body>${markup}</body>`).window.document;
  const aside = doc.querySelector("aside")!;
  const drawer = aside.parentElement!;
  const row = drawer.parentElement!;
  const column = drawer.nextElementSibling!;
  const header = doc.querySelector("header")!;
  const headerNav = header.querySelector("nav");
  return {
    rowFullHeight: row.className.split(/\s+/).includes("min-h-dvh"),
    railStickyFullHeight: ["lg:sticky", "lg:top-0", "lg:h-dvh"].every((token) => drawer.className.split(/\s+/).includes(token)),
    railBeforeColumn: column != null && column.contains(header),
    headerInsideColumn: column.contains(header) && !aside.contains(header),
    columnOrder: Array.from(column.children)
      .map((child) => (child.tagName === "HEADER" ? "header" : child.tagName === "FOOTER" ? "footer" : child.querySelector("main") ? "content" : null))
      .filter(Boolean),
    collapseInHeader: Array.from(header.querySelectorAll("button")).some(isCollapseButton),
    headerNavFromLg: headerNav ? headerNav.className.split(/\s+/).includes("hidden") && headerNav.className.split(/\s+/).includes("lg:flex") : null,
    headerNavInDrawer: Array.from(aside.querySelectorAll("nav .lg\\:hidden a")).map((link) => link.getAttribute("href")),
  };
}

describe.skipIf(!auroraEntry || auroraEntry.contract !== 7)("layout rail = arranjo do Aurora 0.1.13", () => {
  const Aurora = auroraEntry && auroraEntry.contract === 7 ? auroraEntry.Shell : () => null;

  it.each(scenarioNames)("%s: mesmo esqueleto de landmarks e mesmos traços de arranjo", (name) => {
    const props = SLIME_PARITY_SCENARIOS.find((candidate) => candidate.name === name)!.props;
    const aurora = renderToStaticMarkup(<Aurora {...props}>{content}</Aurora>);
    const kit = renderToStaticMarkup(<ThemeRenderer model={kitRailModel(name)}>{content}</ThemeRenderer>);

    expect(skeleton(kit)).toEqual(skeleton(aurora));
    expect(traits(kit)).toEqual(traits(aurora));
    expect(traits(kit)).toMatchObject({
      rowFullHeight: true,
      railStickyFullHeight: true,
      headerInsideColumn: true,
      columnOrder: ["header", "content", "footer"],
      collapseInHeader: true,
    });
  });

  it("o kit continua com skip link e main#conteudo no arranjo rail", () => {
    const doc = new JSDOM(`<body>${renderToStaticMarkup(<ThemeRenderer model={kitRailModel("logged-in")}>{content}</ThemeRenderer>)}</body>`).window.document;
    expect(doc.body.firstElementChild!.matches('a[href="#conteudo"]')).toBe(true);
    expect(doc.querySelector("main")!.id).toBe("conteudo");
    expect(doc.querySelector("[data-layout=rail]")).not.toBeNull();
  });
});
