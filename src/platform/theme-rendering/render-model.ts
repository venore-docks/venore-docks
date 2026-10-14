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
  // Leituras independentes começam juntas (antes eram ~8 awaits em série — cada um uma ida ao
  // banco): documento, trilha, gate de admin e colapso não dependem um do outro; barra contextual
  // só precisa do pathname do documento; nav mode/grupos de admin/manutenção só do gate.
  const documentPromise = resolveDocumentModel();
  const adminGatePromise = getAdminPageData();
  const navPromise = adminGatePromise.then(async (adminGate) => {
    const [navMode, adminNavGroups] = await Promise.all([
      getNavMode(adminGate.granted),
      adminGate.granted ? getVisibleAdminNavGroupsForSidebar(adminGate.actor) : Promise.resolve<NavGroup[]>([]),
    ]);
    return { adminGate, navMode, adminNavGroups };
  });
  const slotPropsPromise = Promise.all([navPromise, getSidebarCollapsed()]).then(([{ adminGate, navMode, adminNavGroups }, collapsed]) =>
    resolveThemeSlotProps({
      navMode,
      adminNavGroups,
      canToggleAdminNav: adminGate.granted,
      onToggleNavMode: toggleNavModeAction,
      canAccessAdmin: adminGate.granted,
      onSignOut,
      collapsed,
      onToggleCollapsed: toggleSidebarCollapsedAction,
    }),
  );

  const [document, breadcrumbs, adminGate, slotProps, contextual, maintenance, page] = await Promise.all([
    documentPromise,
    resolveBreadcrumbs(),
    adminGatePromise,
    slotPropsPromise,
    documentPromise.then((doc) => resolveContextualBar(doc.pathname, contextualSlot)),
    adminGatePromise.then((gate) => resolveMaintenance({ granted: gate.granted })),
    documentPromise.then((doc) => resolvePageLayout(doc.pathname, doc.theme, doc.section)),
  ]);

  // Outlets dependem do usuário já resolvido nas props de slot.
  const outlets = await resolveThemeOutlets(
    {
      pathname: document.pathname ?? "/",
      area: document.area,
      user: slotProps.header.user,
      canAccessAdmin: adminGate.granted,
      themeKey: document.theme.key,
      locale: document.locale,
    },
    document.theme,
  );

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
