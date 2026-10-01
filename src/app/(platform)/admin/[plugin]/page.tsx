import { notFound } from "next/navigation";
import { AdminAccessDenied } from "@/components/admin-access-denied";
import { gateAdminPluginRoute } from "@/platform/plugin-routing/admin-route-gate";
import { resolveAdminPluginRoute } from "@/platform/plugin-routing/resolve-admin-route";

// Caso raiz da rota admin de um plugin: /admin/<plugin> SEM segmento extra — é o que o item de
// navegação do manifesto aponta (href "/admin/erasto-league", "/admin/broadcast"…). Sub-rotas
// (/admin/<plugin>/a/b) ficam no ./[...slug]/page.tsx. Um optional catch-all `[[...slug]]` cobriria
// os dois, mas neste Next ele se comporta mal pro caminho sem sub-segmento (entregava o path
// inteiro como slug → 404) e ainda conflita de especificidade com um page.tsx. Dois arquivos
// separados é o arranjo que funciona.
export default async function AdminPluginRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ plugin: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Piso de acesso antes de qualquer coisa do plugin (admin-route-gate.ts) — nem a existência da
  // rota é revelada a quem não tem acesso ao admin.
  const gate = await gateAdminPluginRoute();
  if (!gate.granted) {
    return <AdminAccessDenied message="Você não tem permissão para acessar esta área." />;
  }

  const { plugin } = await params;
  const resolved = await resolveAdminPluginRoute(plugin, []);
  if (!resolved) {
    notFound();
  }

  const { Component, params: routeParams } = resolved;
  return <Component params={Promise.resolve(routeParams)} searchParams={searchParams} />;
}
