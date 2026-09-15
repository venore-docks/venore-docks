import { getAdminPageData } from "./get-admin-page-data";
import type { AdminPageGate } from "./types";

// Loader "de seção" análogo a get-rbac-page-data.ts, atrás de "rbac.users.manage" — quem só tem
// rbac.registrations.approve (sem gerenciar contas já aprovadas) ainda vê a seção pela navegação
// (requiredPermission OR em rbac/admin-navigation.ts), mas cai neste "acesso negado" ao entrar:
// a fila de pendentes é hoje parte da mesma tela, não uma rota separada com gate próprio.
export async function getCommunityPageData(): Promise<AdminPageGate> {
  const gate = await getAdminPageData();
  if (!gate.granted) {
    return gate;
  }

  const hasCommunityAccess =
    gate.actor.isSuperadmin ||
    gate.actor.permissions.includes("rbac.users.manage") ||
    gate.actor.permissions.includes("rbac.registrations.approve");
  if (!hasCommunityAccess) {
    return { granted: false, reason: "forbidden" };
  }

  return gate;
}
