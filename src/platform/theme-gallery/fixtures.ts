import { createElement, type ReactNode } from "react";
import type { HeaderBrand, ThemeShellProps } from "@/contexts/themes/contracts/types";
import type {
  ContextualMenuItemView,
  PageStateProps,
  RegionCommon,
  ResolvedPageLayout,
  TemplatePropsByKey,
  ThemeEntryView,
  ThemeMobileNavMode,
  ThemeLayoutPreset,
  ThemeOutletName,
  ThemeServerStateKey,
} from "@/contexts/themes/contracts/v8";
import { THEME_OUTLET_NAMES } from "@/contexts/themes/contracts/v8";

// Fixtures da galeria de temas (/admin/themes/gallery) e do harness de CI (spec v8 §7.13/§10) —
// a MESMA fonte de dado pros dois: o que o CI verifica (landmarks, overflow, teclado, axe) é o que
// o admin vê na galeria. Dado puro (sem request, sem banco): props de slot por cenário, templates,
// estados e blocos de exemplo. Dono: W10.
const noop = async () => {};

// Marca em modo texto: sem <img> (nada de rede no setContent do Playwright nem asset quebrado).
const brand: HeaderBrand = {
  name: "Venore Docks",
  mode: "text",
  size: 100,
  scrolledSize: 92,
  position: "left",
  logoUrl: "",
  scrolledLogoUrl: "",
};

export const BASE_SLOT_FIXTURE: Omit<ThemeShellProps, "children"> = {
  header: {
    brand,
    userbarEnabled: true,
    stickyEnabled: true,
    scrollShrinkEnabled: true,
    headerNavItems: [{ key: "home", label: "Início", href: "/" }],
    user: null,
    canAccessAdmin: false,
    onSignOut: noop,
    notificationAlert: null,
    userNavItems: [],
    showLoginLink: true,
  },
  footer: {
    brand: { ...brand, color: "#1f5d43", description: "" },
    sitemapItems: [],
    creditsEnabled: true,
    loginLinkHref: null,
  },
  sidebarLeft: {
    enabled: true,
    navMode: "main",
    navItems: [{ key: "home", label: "Início", href: "/", isExternal: false, opensInNewTab: false }],
    navGroups: [],
    canToggleAdminNav: false,
    onToggleNavMode: noop,
    collapsed: false,
    onToggleCollapsed: noop,
  },
  sidebarContextualEnabled: false,
  sidebarContextual: null,
  breadcrumbs: [],
  breadcrumbsJsonLd: null,
};

export const FIXTURE_USER = { displayName: "Ana Lima", email: "ana@example.com", imageUrl: null };

// Navegação "de verdade": header com 3 itens, rail com ícone, grupo e item externo, rodapé com
// mapa do site — o suficiente pra exercitar teclado, overflow a 390 px e rótulos de <nav>.
const richSlots: Omit<ThemeShellProps, "children"> = {
  ...BASE_SLOT_FIXTURE,
  header: {
    ...BASE_SLOT_FIXTURE.header,
    headerNavItems: [
      { key: "home", label: "Início", href: "/" },
      { key: "blog", label: "Blog", href: "/blog" },
      { key: "sobre", label: "Sobre", href: "/sobre" },
    ],
  },
  footer: {
    ...BASE_SLOT_FIXTURE.footer,
    brand: { ...BASE_SLOT_FIXTURE.footer.brand, description: "Plataforma de conteúdo da comunidade." },
    sitemapItems: [
      {
        key: "institucional",
        label: "Institucional",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        children: [
          { key: "sobre", label: "Sobre", href: "/sobre", isExternal: false, opensInNewTab: false, children: [] },
          { key: "equipe", label: "Equipe", href: "/equipe", isExternal: false, opensInNewTab: false, children: [] },
        ],
      },
    ],
  },
  sidebarLeft: {
    ...BASE_SLOT_FIXTURE.sidebarLeft,
    navItems: [
      { key: "home", label: "Início", href: "/", icon: "home", isExternal: false, opensInNewTab: false },
      {
        key: "secoes",
        label: "Seções",
        href: null,
        children: [
          { key: "blog", label: "Blog", href: "/blog", isExternal: false, opensInNewTab: false },
          { key: "eventos", label: "Eventos", href: "/eventos", isExternal: false, opensInNewTab: false },
        ],
      },
      { key: "docs", label: "Documentação externa", href: "https://example.com", isExternal: true, opensInNewTab: true },
    ],
  },
  breadcrumbs: [
    { key: "home", label: "Início", href: "/", current: false },
    { key: "blog", label: "Blog", href: null, current: true },
  ],
  // `</script>` no dado: o harness confere que o JSON-LD do core escapa (nunca fecha o <script>).
  breadcrumbsJsonLd: {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Blog </script><b>x</b>", item: "/blog" }],
  },
};

const loggedInHeader: ThemeShellProps["header"] = {
  ...richSlots.header,
  user: FIXTURE_USER,
  notificationAlert: { count: 2, href: "/mensagens", label: "2 novas" },
  userNavItems: [{ key: "mensagens", label: "Mensagens", href: "/mensagens" }],
};

export const FIXTURE_CONTEXTUAL_MENU: ContextualMenuItemView[] = [
  { key: "m1", label: "Início da seção", href: "/rh", isExternal: false, isActive: true, icon: null, opensInNewTab: false, children: [] },
  {
    key: "m2",
    label: "Documentos",
    href: null,
    isExternal: false,
    isActive: false,
    icon: null,
    opensInNewTab: false,
    children: [
      { key: "m3", label: "Políticas", href: "/rh/politicas", isExternal: false, isActive: false, icon: null, opensInNewTab: false, children: [] },
      { key: "m4", label: "Portal externo", href: "https://example.com", isExternal: true, isActive: false, icon: null, opensInNewTab: true, children: [] },
    ],
  },
];

export type FixtureContextual = "none" | "menu" | "plugin";

export type ThemeFixtureScenario = {
  name: string;
  label: string;
  area: "public" | "admin";
  pathname: string;
  slots: Omit<ThemeShellProps, "children" | "sidebarContextual" | "sidebarContextualEnabled">;
  contextual: FixtureContextual;
  locale: string;
  dir: "ltr" | "rtl";
  page?: Partial<ResolvedPageLayout>;
  // Um nó marcado em CADA outlet (data-fixture-outlet) — o harness confere o marcador nas regiões.
  outlets?: boolean;
  // Arranjo pedido por seção (só tem efeito em tema v8; 7.x ignora — o Shell é dele).
  arrangement?: { layoutPreset?: ThemeLayoutPreset; mobileNav?: ThemeMobileNavMode };
};

// Cenários do harness (spec §10): visitante, logado, admin, barra contextual (menu e plugin), nav
// vazia, RTL ar, página largura total, outlets, rail colapsada — mais os arranjos v8 (rail e os
// modos de navegação mobile) que só um tema v8 alcança.
export const THEME_FIXTURE_SCENARIOS: readonly ThemeFixtureScenario[] = [
  { name: "anon-public", label: "Visitante", area: "public", pathname: "/blog", slots: richSlots, contextual: "none", locale: "pt-BR", dir: "ltr" },
  {
    name: "logged-in",
    label: "Logado",
    area: "public",
    pathname: "/blog",
    slots: { ...richSlots, header: loggedInHeader },
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
  },
  {
    name: "admin",
    label: "Admin (nav do admin)",
    area: "admin",
    pathname: "/admin/rbac",
    slots: {
      ...richSlots,
      header: { ...loggedInHeader, canAccessAdmin: true },
      sidebarLeft: {
        ...richSlots.sidebarLeft,
        navMode: "admin",
        canToggleAdminNav: true,
        navGroups: [
          {
            key: "pessoas",
            label: "Pessoas",
            items: [
              { key: "rbac.roles", label: "Papéis", href: "/admin/rbac", icon: "users" },
              { key: "users", label: "Usuários", href: "/admin/users", icon: "users" },
            ],
          },
          { key: "site", label: "Site", items: [{ key: "themes", label: "Temas", href: "/admin/themes", icon: "settings" }] },
        ],
      },
      breadcrumbs: [
        { key: "admin", label: "Admin", href: "/admin", current: false },
        { key: "rbac", label: "RBAC", href: null, current: true },
      ],
      breadcrumbsJsonLd: null,
    },
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
  },
  { name: "contextual-menu", label: "Barra contextual (menu)", area: "public", pathname: "/rh", slots: richSlots, contextual: "menu", locale: "pt-BR", dir: "ltr" },
  { name: "contextual-plugin", label: "Barra contextual (plugin)", area: "public", pathname: "/eventos", slots: richSlots, contextual: "plugin", locale: "pt-BR", dir: "ltr" },
  {
    name: "empty-nav",
    label: "Navegação vazia",
    area: "public",
    pathname: "/",
    slots: {
      ...BASE_SLOT_FIXTURE,
      header: { ...BASE_SLOT_FIXTURE.header, headerNavItems: [], showLoginLink: false },
      footer: { ...BASE_SLOT_FIXTURE.footer, sitemapItems: [], creditsEnabled: false },
      sidebarLeft: { ...BASE_SLOT_FIXTURE.sidebarLeft, enabled: false, navItems: [] },
    },
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
  },
  { name: "rtl-ar", label: "RTL (ar)", area: "public", pathname: "/blog", slots: { ...richSlots, header: loggedInHeader }, contextual: "menu", locale: "ar", dir: "rtl" },
  {
    name: "page-full-width",
    label: "Página largura total",
    area: "public",
    pathname: "/landing",
    slots: richSlots,
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
    page: { width: "full", showRail: false, contextualPlacement: "none" },
  },
  { name: "outlets", label: "Outlets de plugin", area: "public", pathname: "/blog", slots: { ...richSlots, header: loggedInHeader }, contextual: "menu", locale: "pt-BR", dir: "ltr", outlets: true },
  {
    name: "collapsed",
    label: "Rail colapsada",
    area: "public",
    pathname: "/blog",
    slots: { ...richSlots, sidebarLeft: { ...richSlots.sidebarLeft, collapsed: true } },
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
  },
  {
    name: "rail-layout",
    label: "Preset rail",
    area: "public",
    pathname: "/blog",
    slots: { ...richSlots, header: loggedInHeader },
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
    arrangement: { layoutPreset: "rail" },
  },
  {
    name: "mobile-bottom-bar",
    label: "Navegação mobile: barra inferior",
    area: "public",
    pathname: "/blog",
    slots: richSlots,
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
    arrangement: { mobileNav: "bottom-bar" },
  },
  {
    name: "mobile-fullscreen",
    label: "Navegação mobile: tela cheia",
    area: "public",
    pathname: "/blog",
    slots: richSlots,
    contextual: "none",
    locale: "pt-BR",
    dir: "ltr",
    arrangement: { mobileNav: "fullscreen" },
  },
];

export function findFixtureScenario(name: string): ThemeFixtureScenario | undefined {
  return THEME_FIXTURE_SCENARIOS.find((scenario) => scenario.name === name);
}

// Nó de plugin da barra contextual (fonte "plugin").
export function fixturePluginContextualNode(): ReactNode {
  return createElement(
    "div",
    { "data-fixture-plugin": "contextual", className: "space-y-2 text-sm text-muted-foreground" },
    createElement("p", { className: "font-medium text-foreground" }, "Agenda do plugin"),
    createElement("a", { href: "/eventos/proximo", className: "text-primary underline" }, "Próximo evento"),
  );
}

// Um nó por outlet, com marcador próprio (o <ThemeOutlet> do kit acrescenta data-outlet em volta).
export function fixtureOutletNodes(names: readonly ThemeOutletName[] = THEME_OUTLET_NAMES): Partial<Record<ThemeOutletName, ReactNode>> {
  return Object.fromEntries(
    names.map((name) => [name, createElement("span", { "data-fixture-outlet": name, className: "text-xs text-muted-foreground" }, `outlet ${name}`)]),
  );
}

// Conteúdo de página: título, parágrafo longo (quebra de linha a 390 px), link e lista.
export function fixturePageContent(): ReactNode {
  return createElement(
    "article",
    { className: "space-y-4", "data-fixture-content": "" },
    createElement("h1", { className: "text-2xl font-semibold text-foreground" }, "Notícias da comunidade"),
    createElement(
      "p",
      { className: "text-muted-foreground" },
      "Um parágrafo de exemplo, comprido o bastante pra quebrar linha em telas pequenas e mostrar a tipografia do tema com ",
      createElement("a", { href: "/blog/post", className: "text-primary underline" }, "um link no meio do texto"),
      ".",
    ),
    createElement(
      "ul",
      { className: "list-disc space-y-1 ps-6 text-foreground" },
      createElement("li", null, "Primeiro item"),
      createElement("li", null, "Segundo item com um texto um pouco maior"),
    ),
  );
}

// --- Templates (spec §2.7) --------------------------------------------------------------------

export const FIXTURE_ENTRY: ThemeEntryView = {
  id: "fixture-entry",
  title: "Como o tema desenha uma página",
  excerpt: "Resumo curto da página, usado em listagens e no compartilhamento.",
  path: "/blog/como-o-tema-desenha",
  publishedAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-15T12:00:00.000Z",
  category: { label: "Blog", href: "/blog" },
  cover: null,
};

const otherEntries: ThemeEntryView[] = [
  FIXTURE_ENTRY,
  { ...FIXTURE_ENTRY, id: "e2", title: "Segunda publicação", path: "/blog/segunda", excerpt: null },
  { ...FIXTURE_ENTRY, id: "e3", title: "Terceira publicação, com um título bem mais comprido", path: "/blog/terceira" },
];

// Props de cada template a partir do comum (strings/locale/dir/opções/área) — conteúdo fixo.
export function buildTemplateFixtures(common: RegionCommon): TemplatePropsByKey {
  const base = { ...common, jsonLd: null, outlets: { before: null, after: null } };
  return {
    home: { ...base, entry: FIXTURE_ENTRY, content: fixturePageContent(), showcase: null, adminShortcuts: [] },
    entry: { ...base, entry: FIXTURE_ENTRY, content: fixturePageContent(), backLink: { href: "/blog", label: "Blog" }, firstBlockIsHero: false },
    category: {
      ...base,
      category: { label: "Blog", description: "Notícias e artigos.", path: "/blog", rssPath: "/blog/rss.xml" },
      entries: otherEntries,
      pagination: { page: 1, pageCount: 2, prevHref: null, nextHref: "/blog?page=2" },
      sort: {
        current: "recent",
        options: [
          { value: "recent", label: "Mais recentes", href: "/blog?sort=recent" },
          { value: "oldest", label: "Mais antigas", href: "/blog?sort=oldest" },
        ],
      },
      empty: null,
    },
    account: {
      ...base,
      title: "Minha conta",
      sections: createElement("div", { className: "rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground" }, "Seções da conta"),
    },
    login: {
      ...base,
      brand,
      form: createElement(
        "form",
        { className: "space-y-3", action: "#" },
        createElement("label", { className: "block text-sm text-foreground", htmlFor: "fixture-email" }, "E-mail"),
        createElement("input", { id: "fixture-email", type: "email", className: "w-full rounded-xl border border-input bg-background px-3 py-2" }),
      ),
      footer: null,
    },
    notFound: { ...base, homeHref: "/" },
  };
}

// --- Estados (spec §2.7 / §7.9) ----------------------------------------------------------------

export const STATE_FIXTURES: Record<ThemeServerStateKey, Pick<PageStateProps, "title" | "message" | "action">> = {
  loading: { title: "Carregando", message: null, action: null },
  empty: { title: "Nada por aqui", message: "Ainda não há publicações nesta seção.", action: { href: "/", label: "Voltar ao início" } },
  forbidden: { title: "Acesso negado", message: "Você não tem permissão para ver esta página.", action: { href: "/login", label: "Entrar" } },
  maintenance: { title: "Em manutenção", message: "Voltamos em instantes.", action: null },
  notFound: { title: "Página não encontrada", message: "O endereço pode ter mudado.", action: { href: "/", label: "Ir para o início" } },
};
