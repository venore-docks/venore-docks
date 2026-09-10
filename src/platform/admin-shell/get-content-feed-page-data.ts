import { getAdminPageData } from "./get-admin-page-data";
import type { AdminPageGate } from "./types";

const CONTENT_FEED_SECTION_PERMISSIONS = ["content-feed.connections.manage", "content-feed.sources.manage"];

// Loader "de seção" do admin (docs/venore-docks.md — regra 13), mesmo padrão de get-cms-page-data.
// A página existe se o ator tiver QUALQUER UMA das duas permissions — cada aba (publicador/
// assinante) dentro dela se mostra/esconde conforme a permission específica.
export async function getContentFeedPageData(): Promise<AdminPageGate> {
  const gate = await getAdminPageData();
  if (!gate.granted) {
    return gate;
  }

  const hasContentFeedAccess =
    gate.actor.isSuperadmin || CONTENT_FEED_SECTION_PERMISSIONS.some((permission) => gate.actor.permissions.includes(permission));
  if (!hasContentFeedAccess) {
    return { granted: false, reason: "forbidden" };
  }

  return gate;
}
