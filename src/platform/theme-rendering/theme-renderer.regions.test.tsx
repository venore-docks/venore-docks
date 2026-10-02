import { describe, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderToReadableStream } from "react-dom/server.edge";
import { JSDOM } from "jsdom";
import {
  DEFAULT_PAGE_LAYOUT,
  defaultThemeConfigDocument,
  type ResolvedPageLayout,
  type ThemeDefinition,
  type ThemeOutletNodes,
  type ThemeRenderModel,
  type ThemeSectionOverride,
} from "@/contexts/themes/contracts/v8";
import type { ThemeManifest } from "@/contexts/themes/contracts/types";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";
import { SLIME_PARITY_SCENARIOS } from "@/themes/venore-slime/parity.fixtures";
import { normalizeThemeDefinition } from "./normalize-entry";
import { resolveArrangement, ThemeRenderer } from "./theme-renderer";

// ThemeRenderer (spec v8 §6, W3): regiões substituíveis uma a uma, override que lança cai na região
// do kit, três modos de navegação mobile, outlets nas regiões do kit, skip link/landmarks e a
// precedência seção → opção reservada → manifesto.
vi.mock("next/navigation", () => ({ usePathname: () => "/blog" }));

const scenario = (name: string) => SLIME_PARITY_SCENARIOS.find((candidate) => candidate.name === name)!;
const content = <p>Conteúdo da página</p>;

type ModelInput = {
  definition?: Partial<ThemeDefinition>;
  manifest?: Partial<ThemeManifest>;
  scenarioName?: string;
  page?: Partial<ResolvedPageLayout>;
  outlets?: ThemeOutletNodes;
  options?: Record<string, string | number | boolean | null>;
  section?: Partial<ThemeSectionOverride> | null;
  area?: "public" | "admin";
};

function model({ definition = {}, manifest = {}, scenarioName = "logged-in", page, outlets = {}, options = {}, section = null, area = "public" }: ModelInput = {}): ThemeRenderModel {
  const props = scenario(scenarioName).props;
  const theme = normalizeThemeDefinition(
    "fixture",
    { ...venoreSlimeTheme, ...definition, manifest: { ...venoreSlimeTheme.manifest, key: "fixture", ...manifest } as ThemeManifest },
    ["fixture"],
  );
  return {
    pathname: "/blog",
    area,
    theme,
    config: { ...defaultThemeConfigDocument("fixture"), revisionId: null, publishedAt: null, source: "legacy-synthesis" },
    section: section ? ({ id: "s", label: "S", pathPrefix: "/blog", ...section } as ThemeSectionOverride) : null,
    options: { values: options, media: {}, ignored: [] },
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
    outlets,
    strings: KIT_STRINGS_PT_BR,
    page: { ...DEFAULT_PAGE_LAYOUT, ...page },
    maintenance: false,
  };
}

const html = (m: ThemeRenderModel) => renderToStaticMarkup(<ThemeRenderer model={m}>{content}</ThemeRenderer>);
const parse = (markup: string) => new JSDOM(`<body>${markup}</body>`).window.document;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOverride = ComponentType<any>;

describe("regiões substituíveis", () => {
  it("substituir uma região troca SÓ ela; o resto é byte a byte o kit", () => {
    const Footer: AnyOverride = ({ Default, ...props }: { Default: ComponentType<object> }) => (
      <>
        <i data-theme-footer="" />
        <Default {...props} />
      </>
    );
    const kit = html(model());
    const replaced = html(model({ definition: { regions: { footer: Footer } } }));
    expect(replaced).toContain('<i data-theme-footer=""></i>');
    expect(replaced.replace('<i data-theme-footer=""></i>', "")).toBe(kit);
  });

  it("override recebe as props v8 da região + Default", () => {
    const seen: Record<string, unknown>[] = [];
    const Header: AnyOverride = (props: Record<string, unknown>) => {
      seen.push(props);
      return <header id="tema" />;
    };
    const markup = html(model({ definition: { regions: { header: Header } } }));
    expect(markup).toContain('<header id="tema"></header>');
    expect(markup).not.toContain('id="site-header"');
    const props = seen[0];
    expect(typeof props.Default).toBe("function");
    expect(props).toMatchObject({ headerNavVisibleFrom: "always", sidebarCollapse: null, area: "public", locale: "pt-BR" });
    expect(Object.keys(props.slots as object).sort()).toEqual(["breadcrumbs", "mobileNavToggle", "outletEnd", "outletStart", "userMenu"]);
  });

  it("override que lança no SSR renderiza a região do kit (fallback do Suspense)", async () => {
    const Boom: AnyOverride = () => {
      throw new Error("tema quebrado");
    };
    const kit = html(model());
    expect(html(model({ definition: { regions: { footer: Boom } } }))).toBe(kit);

    const stream = await renderToReadableStream(<ThemeRenderer model={model({ definition: { regions: { header: Boom } } })}>{content}</ThemeRenderer>, {
      onError: () => {},
    });
    const streamed = await new Response(stream).text();
    expect(streamed).toContain("<!--$!-->"); // client retenta; se lançar de novo, o RegionBoundary segura
    expect(streamed).toContain('id="site-header"');
  });

  it("userMenu substituível dentro do header", () => {
    const UserMenu: AnyOverride = ({ user }: { user: { displayName: string } }) => <span id="menu-tema">{user.displayName}</span>;
    const doc = parse(html(model({ definition: { regions: { userMenu: UserMenu } } })));
    expect(doc.querySelector("header #menu-tema")).not.toBeNull();
    expect(doc.querySelector("header details")).toBeNull();
  });
});

describe("skip link e landmarks", () => {
  it.each(SLIME_PARITY_SCENARIOS.map((candidate) => candidate.name))("%s: skip link primeiro, um main#conteudo, um header, um footer, todo <nav> rotulado", (name) => {
    const markup = html(model({ scenarioName: name }));
    const doc = parse(markup);
    expect(doc.body.firstElementChild!.matches('a[href="#conteudo"]')).toBe(true);
    expect(doc.querySelectorAll("main#conteudo")).toHaveLength(1);
    expect(doc.querySelectorAll("header")).toHaveLength(1);
    expect(doc.querySelectorAll("footer")).toHaveLength(1);
    for (const nav of Array.from(doc.querySelectorAll("nav"))) {
      expect(nav.getAttribute("aria-label"), nav.outerHTML.slice(0, 120)).toBeTruthy();
    }
  });
});

describe("navegação mobile — três modos (cada um: um <nav> rotulado + aria-expanded)", () => {
  function mobileNav(doc: Document) {
    const own = Array.from(doc.querySelectorAll('nav[data-region="mobile-nav"]'));
    return own.length > 0 ? own : Array.from(doc.querySelectorAll("aside[data-region=rail] nav"));
  }

  it("drawer (slime): a rail é o drawer; hambúrguer do header com aria-expanded", () => {
    const doc = parse(html(model()));
    const navs = mobileNav(doc);
    expect(navs).toHaveLength(1);
    expect(navs[0].getAttribute("aria-label")).toBe("Navegação principal");
    expect(doc.querySelector('header button[aria-expanded="false"][aria-label="Abrir navegação"]')).not.toBeNull();
    expect(doc.querySelector('nav[data-region="mobile-nav"]')).toBeNull();
  });

  it("rail escondida pela página: continua montada (drawer abaixo de lg) e marcada pro page-layout.css", () => {
    const doc = parse(html(model({ page: { showRail: false } })));
    expect(doc.querySelector('[data-page-rail-initial="hidden"] aside[data-region=rail]')).not.toBeNull();
    // No modo drawer a própria rail é a navegação mobile (nenhuma camada extra).
    expect(doc.querySelector('nav[data-region="mobile-nav"]')).toBeNull();
  });

  it("drawer sem rail (rail desabilitada): a região monta o próprio drawer", () => {
    const m = model();
    const doc = parse(html({ ...m, slotProps: { ...m.slotProps, sidebarLeft: { ...m.slotProps.sidebarLeft, enabled: false } } }));
    expect(doc.querySelector("aside[data-region=rail]")).toBeNull();
    const navs = mobileNav(doc);
    expect(navs).toHaveLength(1);
    expect(navs[0].getAttribute("data-mobile-nav")).toBe("drawer");
    expect(doc.querySelector('header button[aria-expanded="false"]')).not.toBeNull();
  });

  it("fullscreen: camada de tela cheia; a rail não vira off-canvas", () => {
    const doc = parse(html(model({ manifest: { responsive: { mobileNav: "fullscreen" } } })));
    const navs = doc.querySelectorAll('nav[data-region="mobile-nav"]');
    expect(navs).toHaveLength(1);
    expect(navs[0].getAttribute("aria-label")).toBe("Navegação");
    expect(doc.querySelector('header button[aria-expanded="false"]')).not.toBeNull();
    expect(doc.querySelector("aside[data-region=rail]")!.parentElement!.className).toBe("hidden lg:block lg:shrink-0");
  });

  it("bottom-bar: barra com 'Mais' (aria-expanded); header sem hambúrguer", () => {
    const doc = parse(html(model({ manifest: { responsive: { mobileNav: "bottom-bar" } } })));
    const navs = doc.querySelectorAll('nav[data-region="mobile-nav"]');
    expect(navs).toHaveLength(1);
    expect(navs[0].querySelector('button[aria-expanded="false"]')).not.toBeNull();
    expect(doc.querySelector('header button[aria-label="Abrir navegação"]')).toBeNull();
  });

  it("opção reservada mobile-nav só vale quando o manifesto declara as escolhas; seção vence", () => {
    const base = { manifest: { responsive: { mobileNav: "drawer" as const, mobileNavChoices: ["drawer", "bottom-bar"] as const } } };
    expect(resolveArrangement(model({ ...base, options: { "mobile-nav": "bottom-bar" } })).mobileNav).toBe("bottom-bar");
    expect(resolveArrangement(model({ ...base, options: { "mobile-nav": "fullscreen" } })).mobileNav).toBe("drawer");
    expect(resolveArrangement(model({ options: { "mobile-nav": "bottom-bar" } })).mobileNav).toBe("drawer");
    expect(resolveArrangement(model({ ...base, options: { "mobile-nav": "bottom-bar" }, section: { mobileNav: "fullscreen" } })).mobileNav).toBe("fullscreen");
  });

  it("admin: sempre topbar + drawer, sem opção nem seção", () => {
    const arrangement = resolveArrangement(
      model({ area: "admin", manifest: { layout: { preset: "rail" } }, definition: { layout: "rail" }, options: { "mobile-nav": "bottom-bar" } }),
    );
    expect(arrangement).toEqual({ preset: "topbar", mobileNav: "drawer", collapseControl: "rail", headerNavVisibleFrom: "always" });
  });

  it("navMode admin: a camada mobile recebe os grupos como agregadores", () => {
    const doc = parse(html(model({ scenarioName: "admin", manifest: { responsive: { mobileNav: "fullscreen" } } })));
    const nav = doc.querySelector('nav[data-region="mobile-nav"]')!;
    expect(nav.textContent).toContain("RBAC");
    expect(nav.querySelector("form")).not.toBeNull(); // alternância site/admin (navModeSwitch)
  });
});

describe("layout: preset e arranjo", () => {
  it("preset da seção e opção reservada layout (com presetChoices)", () => {
    expect(resolveArrangement(model({ definition: { layout: "topbar" }, manifest: { layout: { presetChoices: ["topbar", "rail"] } }, options: { layout: "rail" } })).preset).toBe("rail");
    expect(resolveArrangement(model({ definition: { layout: "topbar" }, options: { layout: "rail" } })).preset).toBe("topbar");
    expect(resolveArrangement(model({ definition: { layout: "topbar" }, section: { layoutPreset: "rail" } })).preset).toBe("rail");
  });

  it("rail: padrões do arranjo Aurora (colapso no header, menu do header a partir de lg); manifesto vence", () => {
    expect(resolveArrangement(model({ definition: { layout: "rail" } }))).toMatchObject({ collapseControl: "header", headerNavVisibleFrom: "lg" });
    expect(
      resolveArrangement(model({ definition: { layout: "rail" }, manifest: { layout: { collapseControl: "none", headerNavVisibleFrom: "md" } } })),
    ).toMatchObject({ collapseControl: "none", headerNavVisibleFrom: "md" });
    expect(resolveArrangement(model())).toMatchObject({ preset: "topbar", collapseControl: "rail", headerNavVisibleFrom: "always" });
  });

  it("layout custom do tema recebe as regiões prontas (skip link incluso) e page", () => {
    let received: Record<string, unknown> = {};
    const Custom = (props: { regions: Record<string, ReactNode>; children: ReactNode }) => {
      received = props;
      return (
        <div id="custom">
          {props.regions.skipLink}
          {props.regions.header}
          {props.children}
        </div>
      );
    };
    const doc = parse(html(model({ definition: { layout: Custom } })));
    expect(doc.querySelector('#custom > a[href="#conteudo"]')).not.toBeNull();
    expect(Object.keys(received.regions as object).sort()).toEqual(["breadcrumbs", "contextualBar", "footer", "header", "mobileNav", "rail", "skipLink"]);
    expect(received).toHaveProperty("page");
  });
});

describe("outlets nas regiões do kit (pedido W7)", () => {
  const names = ["header.start", "header.end", "rail.top", "rail.bottom", "footer.top", "footer.bottom", "userMenu.items", "content.before", "content.after"] as const;
  const outlets = Object.fromEntries(names.map((name) => [name, <span key={name} className="o">{name}</span>])) as ThemeOutletNodes;

  it("cada outlet aparece dentro da sua região", () => {
    const doc = parse(html(model({ outlets })));
    const within = (selector: string, name: string) => doc.querySelector(`${selector} [data-outlet="${name}"]`);
    expect(within("header", "header.start")).not.toBeNull();
    expect(within("header", "header.end")).not.toBeNull();
    expect(within("aside[data-region=rail]", "rail.top")).not.toBeNull();
    expect(within("aside[data-region=rail]", "rail.bottom")).not.toBeNull();
    expect(within("footer", "footer.top")).not.toBeNull();
    expect(within("footer", "footer.bottom")).not.toBeNull();
    expect(within("header details", "userMenu.items")).not.toBeNull();
    expect(within("main", "content.before")).not.toBeNull();
    expect(within("main", "content.after")).not.toBeNull();
  });

  it("header.end sem usuário logado: entra junto do link Entrar", () => {
    const doc = parse(html(model({ scenarioName: "anon-public", outlets })));
    const end = doc.querySelector('header [data-outlet="header.end"]')!;
    expect(end.parentElement!.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it("sem outlets: nenhum marcador e nenhum wrapper extra (paridade)", () => {
    expect(html(model())).not.toContain("data-outlet");
  });
});

describe("barra contextual na moldura", () => {
  const contextual = { source: "plugin" as const, pluginKey: "p", node: <p id="ctx">ctx</p> };

  it("placement top e modo mobile top-collapsible chegam ao ContentFrame", () => {
    const m = { ...model({ page: { contextualPlacement: "top" }, manifest: { responsive: { contextualBarMobile: "top-collapsible" } } }), contextual };
    const doc = parse(html(m));
    const aside = doc.querySelector("aside[data-region=contextual]")!;
    expect(aside.nextElementSibling!.tagName).toBe("MAIN");
    expect(doc.querySelector("details[data-contextual-mobile] #ctx")).not.toBeNull();
  });

  it("placement none: sem aside", () => {
    const doc = parse(html({ ...model({ page: { contextualPlacement: "none" } }), contextual }));
    expect(doc.querySelector("aside[data-region=contextual]")).toBeNull();
  });
});
