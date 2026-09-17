import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUserRegistrationStatus } from "@/contexts/auth";
import { getContextualMenu } from "@/contexts/cms";
import { resolveActiveTheme } from "@/platform/theme-rendering/resolve-active-theme";
import { resolveThemeSlotProps } from "@/platform/theme-rendering/resolve-theme-slot-props";
import { hasSidebarContextualContent } from "@/platform/theme-rendering/has-sidebar-contextual-content";
import { resolveContextualBarSource } from "@/platform/theme-rendering/resolve-contextual-bar-source";
import { ContextualMenuNav } from "@/components/contextual-menu-nav";
import { resolveBreadcrumbs } from "@/platform/breadcrumbs/resolve-breadcrumbs";
import { BREADCRUMB_PATHNAME_HEADER } from "@/platform/breadcrumbs/pathname-header";
import { RouteChangeRefresher } from "@/platform/breadcrumbs/route-change-refresher";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import { getVisibleAdminNavGroupsForSidebar } from "@/platform/admin-shell/admin-navigation-registry";
import { getNavMode } from "@/platform/nav-mode/get-nav-mode";
import { toggleNavModeAction } from "@/platform/nav-mode/toggle-nav-mode-action";
import { getSidebarCollapsed } from "@/platform/sidebar-collapse/get-sidebar-collapsed";
import { toggleSidebarCollapsedAction } from "@/platform/sidebar-collapse/toggle-sidebar-collapsed-action";
import { signOutAction } from "@/app/(auth)/actions";
import type { NavGroup } from "@/contexts/themes";

// Shell única (docs/venore-docks.md — "Shell única — sem área admin separada"): o `Shell` do
// tema ativo é montado uma única vez aqui, pra toda página pública, academy e admin — não existe
// mais um layout de admin à parte com casca própria. Este arquivo só resolve dados (gate, nav
// mode, cookies) e repassa pro `Shell`; a árvore/arranjo entre header/footer/sidebar/conteúdo é
// decisão do tema, não deste layout (docs/themes/shell-contract.md — Abordagem A).
export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
  sidebarContextual,
}: {
  children: React.ReactNode;
  // Slot paralelo @sidebarContextual (Next.js parallel routes) — só as rotas que definem um
  // page.tsx dentro de app/(platform)/@sidebarContextual/<segmento> preenchem isso; as demais
  // caem no default.tsx do slot, que devolve null. `sidebarContextual` em si NUNCA é usado pra
  // decidir se tem conteúdo (ver has-sidebar-contextual-content.ts pra por quê) — só é renderizado
  // quando hasSidebarContextualContent(pathname) já disse que sim.
  sidebarContextual: React.ReactNode;
}) {
  const registrationStatus = await getCurrentUserRegistrationStatus();
  if (registrationStatus.success && registrationStatus.data === "pending") {
    redirect("/pending-approval");
  }

  const { Shell } = await resolveActiveTheme();

  const breadcrumbs = await resolveBreadcrumbs();

  // Mesmo header que resolve-breadcrumbs.ts lê (escrito em src/proxy.ts a cada request, mantido
  // fresco entre navegações client-side pelo mesmo RouteChangeRefresher abaixo) — nunca o prop
  // `sidebarContextual` em si, que não reflete com confiança nem "tem conteúdo" nem "é da rota
  // atual" (ver has-sidebar-contextual-content.ts).
  const pathname = (await headers()).get(BREADCRUMB_PATHNAME_HEADER);
  const pluginHasContextualContent = hasSidebarContextualContent(pathname);

  // Menu Contextual do CMS (/admin/cms/menus, location "contextual", scopePath) — Known Gap
  // documentado em resolve-theme-slot-props.ts até esta sessão: getContextualMenu já existia e
  // tinha UI completa, mas nenhum consumidor. resolveContextualBarSource decide a precedência
  // entre isto e o conteúdo de plugin (Mecanismo A acima).
  const contextualMenuResult = pathname ? await getContextualMenu({ path: pathname }) : { success: true as const, data: [] };
  const contextualMenuItems = contextualMenuResult.success ? contextualMenuResult.data : [];
  const contextualBarSource = resolveContextualBarSource(pluginHasContextualContent, contextualMenuItems.length);
  const sidebarContextualEnabled = contextualBarSource !== "none";

  const adminGate = await getAdminPageData();
  const canToggleAdminNav = adminGate.granted;
  const navMode = await getNavMode(canToggleAdminNav);
  const adminNavGroups: NavGroup[] = adminGate.granted ? await getVisibleAdminNavGroupsForSidebar(adminGate.actor) : [];
  const collapsed = await getSidebarCollapsed();

  const props = await resolveThemeSlotProps({
    navMode,
    adminNavGroups,
    canToggleAdminNav,
    onToggleNavMode: toggleNavModeAction,
    canAccessAdmin: adminGate.granted,
    onSignOut: signOutAction,
    collapsed,
    onToggleCollapsed: toggleSidebarCollapsedAction,
  });

  return (
    <>
      <RouteChangeRefresher />
      <Shell
        header={props.header}
        footer={props.footer}
        sidebarLeft={props.sidebarLeft}
        sidebarContextualEnabled={sidebarContextualEnabled}
        sidebarContextual={
          contextualBarSource === "plugin" ? (
            sidebarContextual
          ) : contextualBarSource === "menu" ? (
            <ContextualMenuNav items={contextualMenuItems} />
          ) : null
        }
        breadcrumbs={breadcrumbs.items}
        breadcrumbsJsonLd={breadcrumbs.jsonLd}
      >
        {children}
      </Shell>
    </>
  );
}
