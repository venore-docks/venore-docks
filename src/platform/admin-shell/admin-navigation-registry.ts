import type { NavGroup } from "@/contexts/themes";
import { cmsAdminNavigationItems } from "@/contexts/cms";
import { contentFeedAdminNavigationItems } from "@/contexts/content-feed";
import { importExportAdminNavigationItems } from "@/contexts/import-export";
import { mediaAdminNavigationItems } from "@/contexts/media";
import { rbacAdminNavigationItems } from "@/contexts/rbac";
import { settingsAdminNavigationItems } from "@/contexts/settings";
import { themesAdminNavigationItems } from "@/contexts/themes";
import { observabilityAdminNavigationItems } from "@/observability";
import { registerPlugins } from "../plugin-engine/register-plugins";
import { assertUniqueNavigationKeys, buildVisibleAdminNavGroups } from "./admin-navigation-registry.core";
import type { AdminNavItemDefinition } from "./admin-navigation.contracts";
import { platformAdminNavigationItems } from "./platform-admin-navigation";
import type { AdminActor } from "./types";

export { assertUniqueNavigationKeys, buildVisibleAdminNavGroups };

// Registro de navegação admin (docs/venore-docks.md — "Shell única" / "Sistema de plugins"):
// cada context e cada plugin declara os próprios itens (AdminNavItemDefinition); esta função só
// agrega, valida chave única e devolve a lista plana — nenhuma tela é enumerada à mão aqui, só
// os módulos-fonte (mesmo espírito de src/plugins/registry.ts: Next.js exige import estático).
export async function collectAdminNavigationItems(): Promise<AdminNavItemDefinition[]> {
  const pluginReport = await registerPlugins();

  const items: AdminNavItemDefinition[] = [
    ...platformAdminNavigationItems,
    ...rbacAdminNavigationItems,
    ...cmsAdminNavigationItems,
    ...contentFeedAdminNavigationItems,
    ...mediaAdminNavigationItems,
    ...importExportAdminNavigationItems,
    ...settingsAdminNavigationItems,
    ...themesAdminNavigationItems,
    ...observabilityAdminNavigationItems,
    ...pluginReport.navigation,
  ];

  assertUniqueNavigationKeys(items);

  return items;
}

export async function getVisibleAdminNavGroupsForSidebar(actor: AdminActor): Promise<NavGroup[]> {
  const items = await collectAdminNavigationItems();
  return buildVisibleAdminNavGroups(actor, items);
}
