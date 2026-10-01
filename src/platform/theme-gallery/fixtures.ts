import type { ThemeShellProps } from "@/contexts/themes/contracts/types";

// Fixtures base da galeria de temas e do harness de CI (spec §7.13/§10). Dono: W10, que amplia
// (templates, estados, blocos). Na Fase F: as props de slot mínimas de um visitante anônimo.
const noop = async () => {};

export const BASE_SLOT_FIXTURE: Omit<ThemeShellProps, "children"> = {
  header: {
    brand: { name: "Venore Docks", mode: "text", size: 100, scrolledSize: 92, position: "left", logoUrl: "", scrolledLogoUrl: "" },
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
    brand: { name: "Venore Docks", mode: "text", size: 100, scrolledSize: 92, position: "left", logoUrl: "", scrolledLogoUrl: "", color: "#1f5d43", description: "" },
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
