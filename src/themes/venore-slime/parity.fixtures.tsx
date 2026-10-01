import type { ThemeShellProps } from "@/contexts/themes/contracts/types";
import { ContextualMenuNav } from "@/components/contextual-menu-nav";

// Cenários do snapshot de paridade do venore-slime (spec v8 §12, Fase F passo 0). Cada cenário é
// um ThemeShellProps completo; o snapshot HTML de cada um (em __parity__/) foi gravado ANTES da
// mudança do Shell para o kit (src/theme-sdk/kit) e precisa continuar byte a byte igual depois —
// tanto pelo `Shell` reexportado quanto pelo caminho v8 (ThemeRenderer + layout "topbar").

const noop = async () => {};

const baseHeader: ThemeShellProps["header"] = {
  brand: {
    name: "Venore Docks",
    mode: "svg",
    size: 100,
    scrolledSize: 92,
    position: "left",
    logoUrl: "/brand/brand-logo.svg",
    scrolledLogoUrl: "/brand/brand-logo-scrolled.png",
  },
  userbarEnabled: true,
  stickyEnabled: true,
  scrollShrinkEnabled: true,
  headerNavItems: [
    { key: "home", label: "Home", href: "/" },
    { key: "blog", label: "Blog", href: "/blog" },
  ],
  user: null,
  canAccessAdmin: false,
  onSignOut: noop,
  notificationAlert: null,
  userNavItems: [],
  showLoginLink: true,
};

const baseFooter: ThemeShellProps["footer"] = {
  brand: { ...baseHeader.brand, color: "#1f5d43", description: "Plataforma de conteúdo." },
  sitemapItems: [
    {
      key: "s1",
      label: "Institucional",
      href: null,
      isExternal: false,
      opensInNewTab: false,
      children: [{ key: "s1a", label: "Sobre", href: "/sobre", isExternal: false, opensInNewTab: false, children: [] }],
    },
  ],
  creditsEnabled: true,
  loginLinkHref: null,
};

const baseSidebar: ThemeShellProps["sidebarLeft"] = {
  enabled: true,
  navMode: "main",
  navItems: [
    { key: "home", label: "Home", href: "/", icon: "home", isExternal: false, opensInNewTab: false },
    {
      key: "grp",
      label: "Seções",
      href: null,
      children: [{ key: "blog", label: "Blog", href: "/blog", isExternal: false, opensInNewTab: false }],
    },
  ],
  navGroups: [],
  canToggleAdminNav: false,
  onToggleNavMode: noop,
  collapsed: false,
  onToggleCollapsed: noop,
};

const base: Omit<ThemeShellProps, "children"> = {
  header: baseHeader,
  footer: baseFooter,
  sidebarLeft: baseSidebar,
  sidebarContextualEnabled: false,
  sidebarContextual: null,
  breadcrumbs: [],
  breadcrumbsJsonLd: null,
};

const user = { displayName: "Ana Lima", email: "ana@example.com", imageUrl: null };

// Mesmo menu nos dois caminhos: ResolvedMenuItem (Shell 7.x, via ContextualMenuNav) e dado
// (ThemeRenderer, via resolve-contextual-bar).
export const PARITY_CONTEXTUAL_MENU: Parameters<typeof ContextualMenuNav>[0]["items"] = [
  { id: "m1", label: "Início da seção", href: "/rh", icon: null, isExternal: false, opensInNewTab: false, children: [] },
  {
    id: "m2",
    label: "Grupo",
    href: null,
    icon: null,
    isExternal: false,
    opensInNewTab: false,
    children: [{ id: "m3", label: "Externo", href: "https://example.com", icon: null, isExternal: true, opensInNewTab: true, children: [] }],
  },
];
export const PARITY_PLUGIN_NODE = <div data-plugin-contextual="x">Conteúdo do plugin</div>;

export type ParityScenario = {
  name: string;
  props: Omit<ThemeShellProps, "children">;
  contextual: "none" | "menu" | "plugin";
};

export const SLIME_PARITY_SCENARIOS: ParityScenario[] = [
  { name: "anon-public", props: base, contextual: "none" },
  {
    name: "logged-in",
    props: {
      ...base,
      header: {
        ...baseHeader,
        user,
        notificationAlert: { count: 2, href: "/mensagens", label: "2 novas" },
        userNavItems: [{ key: "msgs", label: "Mensagens", href: "/mensagens" }],
      },
    },
    contextual: "none",
  },
  {
    name: "admin",
    props: {
      ...base,
      header: { ...baseHeader, user, canAccessAdmin: true },
      sidebarLeft: {
        ...baseSidebar,
        navMode: "admin",
        canToggleAdminNav: true,
        navGroups: [
          { key: "rbac", label: "RBAC", items: [{ key: "rbac.roles", label: "Papéis", href: "/admin/rbac", icon: "users" }] },
        ],
      },
      breadcrumbs: [
        { key: "admin", label: "Admin", href: "/admin", current: false },
        { key: "rbac", label: "RBAC", href: null, current: true },
      ],
    },
    contextual: "none",
  },
  {
    name: "contextual-menu",
    props: {
      ...base,
      sidebarContextualEnabled: true,
      sidebarContextual: <ContextualMenuNav items={PARITY_CONTEXTUAL_MENU} />,
    },
    contextual: "menu",
  },
  {
    name: "contextual-plugin",
    props: { ...base, sidebarContextualEnabled: true, sidebarContextual: PARITY_PLUGIN_NODE },
    contextual: "plugin",
  },
  {
    name: "empty-nav",
    props: {
      ...base,
      header: { ...baseHeader, headerNavItems: [], showLoginLink: false },
      footer: { ...baseFooter, sitemapItems: [], creditsEnabled: false, brand: { ...baseFooter.brand, description: "" } },
      sidebarLeft: { ...baseSidebar, enabled: false, navItems: [] },
    },
    contextual: "none",
  },
  {
    name: "collapsed-static-header",
    props: {
      ...base,
      header: {
        ...baseHeader,
        stickyEnabled: false,
        scrollShrinkEnabled: false,
        userbarEnabled: false,
        brand: { ...baseHeader.brand, mode: "text", position: "center" },
      },
      footer: { ...baseFooter, loginLinkHref: "/login" },
      sidebarLeft: { ...baseSidebar, collapsed: true },
    },
    contextual: "none",
  },
  {
    name: "breadcrumbs-json-ld",
    props: {
      ...base,
      breadcrumbs: [
        { key: "home", label: "Início", href: "/", current: false },
        { key: "blog", label: "Blog", href: "/blog", current: false },
        { key: "post", label: "Post </script><b>x</b>", href: null, current: true },
      ],
      breadcrumbsJsonLd: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [{ "@type": "ListItem", position: 1, name: "Post </script>", item: "/blog/post" }],
      },
    },
    contextual: "none",
  },
];

// Remove marcadores que a v8 acrescenta só como gancho de CSS/diagnóstico (spec §12 passo 0) — o
// resto do markup precisa ficar idêntico.
export function normalizeParityHtml(html: string): string {
  return html.replace(/ data-(?:region|outlet|block[a-z-]*)(?:="[^"]*")?/g, "");
}
