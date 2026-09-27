import { notFound } from "next/navigation";
import { AdminAccessDenied } from "@/components/admin-access-denied";
import { gateAdminPluginRoute } from "@/platform/plugin-routing/admin-route-gate";
import { resolveAdminPluginRoute } from "@/platform/plugin-routing/resolve-admin-route";

// Sub-rotas de uma rota admin de plugin: /admin/<plugin>/a/b/c. O caso raiz (/admin/<plugin> sem
// segmento extra) é o ../page.tsx irmão — NÃO um optional catch-all `[[...slug]]`, que neste Next
// (16.x), aninhado sob `[plugin]` dentro de um route group, entrega o caminho INTEIRO como slug
// quando não há sub-segmento (visto em log: rawSlug=["admin","erasto-league"]) e a rota virava
// 404. Catch-all obrigatório + page.tsx separado é o que o Next aceita lado a lado (o optional
// conflitava com o page.tsx por "mesma especificidade").
export default async function AdminPluginSubRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ plugin: string; slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Piso de acesso antes de qualquer coisa do plugin (admin-route-gate.ts) — nem a existência da
  // rota é revelada a quem não tem acesso ao admin.
  const gate = await gateAdminPluginRoute();
  if (!gate.granted) {
    return <AdminAccessDenied message="Você não tem permissão para acessar esta área." />;
  }

  const { plugin, slug } = await params;
  const resolved = await resolveAdminPluginRoute(plugin, slug);
  if (!resolved) {
    notFound();
  }

  const { Component, params: routeParams } = resolved;
  return <Component params={Promise.resolve(routeParams)} searchParams={searchParams} />;
}
