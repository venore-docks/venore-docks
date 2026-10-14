import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import type { MainNavItem } from "@/contexts/themes/contracts/types";
import type { ThemeMobileNavMode } from "@/contexts/themes/contracts/v8";
import { KIT_STRINGS_PT_BR } from "../../i18n/t";
import { MobileNav, splitBottomBarItems, type KitMobileNavProps } from "./mobile-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/blog" }));

// Região mobileNav do kit (spec v8 §7.8): cada modo monta UM <nav> rotulado e um controle com
// aria-expanded (drawer/tela cheia: o hambúrguer do header — ver theme-renderer.regions.test;
// bottom-bar: o "Mais" dentro da própria barra).
const items: MainNavItem[] = [
  { key: "home", label: "Home", href: "/", icon: "home" },
  { key: "blog", label: "Blog", href: "/blog" },
  { key: "a", label: "A", href: "/a" },
  { key: "b", label: "B", href: "/b" },
  { key: "c", label: "C", href: "/c" },
  { key: "d", label: "D", href: "/d" },
  { key: "grp", label: "Seções", href: null, children: [{ key: "x", label: "X", href: "/x" }] },
];

function props(mode: ThemeMobileNavMode, extra: Partial<KitMobileNavProps> = {}): KitMobileNavProps {
  return {
    strings: KIT_STRINGS_PT_BR,
    locale: "pt-BR",
    dir: "ltr",
    options: {},
    area: "public",
    mode,
    navMode: "main",
    items,
    headerNavItems: [{ key: "sobre", label: "Sobre", href: "/sobre" }],
    railNode: null,
    navModeSwitch: null,
    ...extra,
  };
}

function dom(mode: ThemeMobileNavMode, extra?: Partial<KitMobileNavProps>) {
  return new JSDOM(`<body>${renderToStaticMarkup(<MobileNav {...props(mode, extra)} />)}</body>`).window.document;
}

describe("MobileNav — três modos", () => {
  it("drawer com rail: a rail é o drawer, a região não acrescenta markup (paridade slime)", () => {
    expect(renderToStaticMarkup(<MobileNav {...props("drawer", { railNode: <aside /> })} />)).toBe("");
  });

  it.each(["drawer", "fullscreen", "bottom-bar"] as const)("%s: exatamente um <nav> rotulado", (mode) => {
    const doc = dom(mode);
    const navs = doc.querySelectorAll("nav");
    expect(navs).toHaveLength(1);
    expect(navs[0].getAttribute("aria-label")).toBe("Navegação");
    expect(navs[0].getAttribute("data-mobile-nav")).toBe(mode);
  });

  it("drawer sem rail / tela cheia: painel fechado no SSR fica fora do Tab (inert / hidden)", () => {
    expect(dom("drawer").querySelector("#kit-mobile-nav")!.hasAttribute("inert")).toBe(true);
    expect(dom("fullscreen").querySelector("#kit-mobile-nav")!.hasAttribute("hidden")).toBe(true);
    expect(dom("fullscreen").querySelector('[role="dialog"]')!.getAttribute("aria-modal")).toBe("true");
  });

  it("bottom-bar: até 5 itens na barra + 'Mais' com aria-expanded/aria-controls; o resto vai pra folha", () => {
    const doc = dom("bottom-bar", { headerNavVisibleFrom: "lg" });
    const nav = doc.querySelector("nav")!;
    expect(nav.querySelectorAll("li a")).toHaveLength(5);
    const more = nav.querySelector("button")!;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(more.getAttribute("aria-controls")).toBe("kit-mobile-more");
    const sheet = doc.getElementById("kit-mobile-more")!;
    expect(sheet.textContent).toContain("D"); // excedente
    expect(sheet.textContent).toContain("Seções"); // agregador
    expect(sheet.textContent).toContain("Sobre"); // menu do header que some abaixo de lg
    expect(doc.querySelector('[data-mobile-bottom-bar-spacer]')!.className).toContain("h-(--mobile-bottom-bar-height)");
    expect(doc.body.innerHTML).toContain("[--mobile-bottom-bar-height:calc(var(--spacing)*16)]");
  });

  it("bottom-bar sem excedente nem extras: sem 'Mais'", () => {
    const doc = dom("bottom-bar", { items: items.slice(0, 3) });
    expect(doc.querySelector("nav button")).toBeNull();
    expect(doc.getElementById("kit-mobile-more")).toBeNull();
  });

  it("aria-current no item da rota atual", () => {
    const doc = dom("bottom-bar");
    expect(doc.querySelector('a[href="/blog"]')!.getAttribute("aria-current")).toBe("page");
  });

  it("menu do header só entra na camada mobile quando some do header", () => {
    expect(dom("fullscreen").body.textContent).not.toContain("Sobre");
    expect(dom("fullscreen", { headerNavVisibleFrom: "md" }).body.textContent).toContain("Sobre");
  });

  it("splitBottomBarItems: agregadores nunca vão pra barra", () => {
    const { barItems, rest } = splitBottomBarItems([items[6], ...items.slice(0, 2)]);
    expect(barItems.map((item) => item.key)).toEqual(["home", "blog"]);
    expect(rest.map((item) => item.key)).toEqual(["grp"]);
  });
});
