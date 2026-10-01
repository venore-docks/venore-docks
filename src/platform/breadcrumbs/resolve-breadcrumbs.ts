import { cache } from "react";
import { headers } from "next/headers";
import { BREADCRUMB_PATHNAME_HEADER } from "./pathname-header";
import { collectBreadcrumbSegments } from "./registry";
import { matchSegments } from "./match-segments";
import { toJsonLdSafeText } from "@/shared/json-ld";
import { BREADCRUMB_SEGMENT_NOT_OWNED } from "./types";
import type { ResolvedBreadcrumbs } from "./types";

function splitPathname(pathname: string): string[] {
  return pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));
}

function warnUnresolvedSegment(key: string, segments: string[]): void {
  if (process.env.NODE_ENV === "production") return;
  // Dev-only: um segmento sem rótulo não vira texto cru na tela (ele só é omitido da trilha), mas
  // isso não deveria passar silencioso pra quem tá registrando rota nova — avisa no terminal.
  console.warn(
    `[breadcrumbs] "/${segments.join("/")}" (${key}) não resolveu rótulo — omitido da trilha em vez de aparecer como texto cru.`,
  );
}

function resolveSiteOrigin(headersList: Headers): string | null {
  const host = headersList.get("host");
  if (!host) return null;
  const proto = headersList.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

// Chamado uma única vez por request, do único layout de (platform)/layout.tsx (Shell única,
// AGENTS.md). cache() garante isso mesmo que algum dia mais de um ponto da árvore de Server
// Components precise da trilha no mesmo request (mesmo motivo de resolve-active-theme.ts).
//
// Eficiência: matchSegments é síncrono e puro — nenhuma consulta disparada pelos segmentos
// estáticos. Os segmentos dinâmicos (no máximo um ou dois por rota neste app) são resolvidos em
// paralelo via Promise.all, nunca um a um em cascata — ver
// resolve-breadcrumbs.batching.test.ts para a prova disso.
export const resolveBreadcrumbs = cache(async (): Promise<ResolvedBreadcrumbs> => {
  const headersList = await headers();
  const pathname = headersList.get(BREADCRUMB_PATHNAME_HEADER);
  if (!pathname) return { items: [], jsonLd: null };

  const definitions = await collectBreadcrumbSegments();
  const matches = matchSegments(splitPathname(pathname), definitions);

  const resolved = await Promise.all(
    matches.map(async (match) => {
      const result = await match.definition.resolve(match.params);
      // Wildcard posicional que casou pela forma da URL mas o caminho é de outro dono (rota de
      // plugin, 404, plugin desativado) — omite sem avisar: não é rótulo faltando.
      if (result === BREADCRUMB_SEGMENT_NOT_OWNED) {
        return null;
      }
      if (result === null) {
        warnUnresolvedSegment(match.definition.key, match.definition.segments);
        return null;
      }
      return { key: match.definition.key, label: result.label, href: result.href };
    }),
  );

  const resolvedItems = resolved.filter((item): item is { key: string; label: string; href: string | null } => item !== null);
  if (resolvedItems.length === 0) return { items: [], jsonLd: null };

  const lastIndex = resolvedItems.length - 1;
  const items = resolvedItems.map((item, index) => ({
    key: item.key,
    label: item.label,
    // Item atual nunca é link, mesmo se o registro deu um href pra ele (docs do pedido: "item
    // atual não é link e é marcado com aria-current" — a marcação em si é responsabilidade do
    // componente de UI, aqui só garantimos href null pra não virar <a>).
    href: index === lastIndex ? null : item.href,
    current: index === lastIndex,
  }));

  const origin = resolveSiteOrigin(headersList);
  const jsonLd = origin
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: resolvedItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          // Rótulo é texto de usuário (título de entry, nome de arquivo). Temas externos ainda
          // serializam com JSON.stringify cru — neutraliza `<`/`>` aqui na origem.
          name: toJsonLdSafeText(item.label),
          // schema.org BreadcrumbList espera URL absoluta em todo item, inclusive o atual — por
          // isso usa `item.href` original (antes do href:null aplicado só pra UI acima); quando o
          // próprio registro declarou href null (nível sem página própria, ex: "entries/new"), cai
          // na URL da página atual — imprecisão aceitável pra um nó que não é navegável mesmo.
          item: toJsonLdSafeText(`${origin}${item.href ?? pathname}`),
        })),
      }
    : null;

  return { items, jsonLd };
});
