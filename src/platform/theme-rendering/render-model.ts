import type { ReactNode } from "react";
import type { NavGroup } from "@/contexts/themes";
import type { ThemeRenderModel } from "@/contexts/themes/contracts/v8";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import { getVisibleAdminNavGroupsForSidebar } from "@/platform/admin-shell/admin-navigation-registry";
import { resolveBreadcrumbs } from "@/platform/breadcrumbs/resolve-breadcrumbs";
import { getNavMode } from "@/platform/nav-mode/get-nav-mode";
import { toggleNavModeAction } from "@/platform/nav-mode/toggle-nav-mode-action";
import { resolvePageLayout } from "@/platform/page-builder/page-layout";
import { getSidebarCollapsed } from "@/platform/sidebar-collapse/get-sidebar-collapsed";
import { toggleSidebarCollapsedAction } from "@/platform/sidebar-collapse/toggle-sidebar-collapsed-action";
import { resolveDocumentModel } from "./document-model";
import { resolveContextualBar } from "./resolve-contextual-bar";
import { resolveMaintenance } from "./resolve-maintenance";
import { resolveThemeOutlets } from "./resolve-theme-outlets";
import { resolveThemeSlotProps } from "./resolve-theme-slot-props";
import { resolveThemeStrings } from "./resolve-theme-strings";

export type ResolveThemeRenderModelInput = {
  // Slot paralelo @sidebarContextual (já renderizado pela rota).
  contextualSlot: ReactNode;
  // Server action de sair — mora em app/(auth)/actions, que platform/ não importa.
  onSignOut: () => Promise<void>;
};

// Modelo de render do (platform)/layout — spec §6. Mesmo dado que o layout montava antes da v8
// (gate de admin, nav mode, colapso, trilha, barra contextual, props de slot 7.x), mais o que a v8
// acrescenta atrás de resolvers com dono (outlets W7, strings W8, layout de página W5,
// manutenção W4). Congelado depois da Fase F.
export async function resolveThemeRenderModel({ contextualSlot, onSignOut }: ResolveThemeRenderModelInput): Promise<ThemeRenderModel> {
  const document = await resolveDocumentModel();
  const breadcrumbs = await resolveBreadcrumbs();
  const contextual = await resolveContextualBar(document.pathname, contextualSlot);

  const adminGate = await getAdminPageData();
  const canToggleAdminNav = adminGate.granted;
  const navMode = await getNavMode(canToggleAdminNav);
  const adminNavGroups: NavGroup[] = adminGate.granted ? await getVisibleAdminNavGroupsForSidebar(adminGate.actor) : [];
  const collapsed = await getSidebarCollapsed();

  const slotProps = await resolveThemeSlotProps({
    navMode,
    adminNavGroups,
    canToggleAdminNav,
    onToggleNavMode: toggleNavModeAction,
    canAccessAdmin: adminGate.granted,
    onSignOut,
    collapsed,
    onToggleCollapsed: toggleSidebarCollapsedAction,
  });

  const [maintenance, outlets, page] = await Promise.all([
    resolveMaintenance({ granted: adminGate.granted }),
    resolveThemeOutlets(
      {
        pathname: document.pathname ?? "/",
        area: document.area,
        user: slotProps.header.user,
        canAccessAdmin: adminGate.granted,
        themeKey: document.theme.key,
        locale: document.locale,
      },
      document.theme,
    ),
    resolvePageLayout(document.pathname, document.theme, document.section),
  ]);

  return {
    ...document,
    slotProps,
    breadcrumbs: breadcrumbs.items,
    breadcrumbsJsonLd: breadcrumbs.jsonLd,
    contextual,
    outlets,
    strings: resolveThemeStrings(document.theme, document.locale),
    page,
    maintenance,
  };
}
