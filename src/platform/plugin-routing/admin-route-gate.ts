import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import type { AdminPageGate } from "@/platform/admin-shell/types";

// Piso de acesso de TODA rota admin de plugin, aplicado pelo despachante antes de resolver a
// rota: sessão + platform.admin.access (ou superadmin). Não substitui o gate de seção que cada
// página faz (getPluginAdminPageData / permission própria) — garante só que um plugin que
// esqueça o seu não fica aberto pra anônimo ou pra usuário sem acesso ao admin.
export async function gateAdminPluginRoute(): Promise<AdminPageGate> {
  return getAdminPageData();
}
