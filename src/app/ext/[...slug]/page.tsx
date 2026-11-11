import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveStandalonePluginRoute } from "@/platform/plugin-routing/resolve-standalone-route";

// Prefixo genérico ÚNICO de toda rota de plugin que precisa fugir da shell do (platform) — telas
// de token (saída de TV, quiosque, painel) e apps instaláveis (PWA própria de um plugin).
// `/ext/<o-que-o-plugin-declarar>`. O core não conhece nome de plugin nem namespace de plugin: só
// existe /ext, e o resto (`broadcast/out/:token` etc.) vem da área `standalone` da route-table de
// cada plugin, casada por resolveStandalonePluginRoute.
// `dynamic` é export direto porque route segment config não é lido via reexport (AGENTS.md §1.1).
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// <head> opcional da entrada casada (ex.: `manifest` próprio de uma PWA de plugin, título, ícone
// de iOS). Sem generateMetadata na entrada, herda tudo do layout raiz, como antes.
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveStandalonePluginRoute(slug);
  if (resolved.kind !== "matched" || !resolved.generateMetadata) {
    return {};
  }
  return resolved.generateMetadata({ params: Promise.resolve(resolved.params), searchParams });
}

export default async function StandalonePluginRoute({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolved = await resolveStandalonePluginRoute(slug);
  if (resolved.kind !== "matched") {
    notFound();
  }

  const { Component, params: routeParams } = resolved;
  return <Component params={Promise.resolve(routeParams)} searchParams={searchParams} />;
}
