import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbItem } from "@/contexts/themes/contracts/types";
import { serializeJsonLd } from "@/theme-sdk/json-ld";

// Puramente apresentacional — recebe a trilha e o JSON-LD já resolvidos no servidor
// (platform/breadcrumbs/resolve-breadcrumbs.ts) e só renderiza; nunca busca rota/entidade sozinho
// (Contrato de slot, mesmo princípio de HeaderSlot/FooterSlot). O design é deste tema
// especificamente — outro tema é livre de desenhar a própria trilha do próprio jeito, contanto que
// receba os mesmos `breadcrumbs`/`breadcrumbsJsonLd`.
//
// Colapso mobile (docs do pedido: "primeiro e último visíveis"): sem contar item, escondo os itens
// do meio abaixo do breakpoint `sm` (mobile-first, AGENTS.md §4 — base sem prefixo é o estado
// mobile) e mostro um "…" decorativo só nessa faixa. Nada é removido da árvore de acessibilidade —
// é só `hidden`/`sm:inline-flex` no <li>, a lista completa (<ol>) continua exposta a leitor de
// tela em qualquer largura de tela.
export function Breadcrumbs({
  breadcrumbs,
  breadcrumbsJsonLd,
}: {
  breadcrumbs: BreadcrumbItem[];
  breadcrumbsJsonLd: Record<string, unknown> | null;
}) {
  if (breadcrumbs.length === 0) return null;

  const hasCollapsibleMiddle = breadcrumbs.length > 2;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:px-8">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === breadcrumbs.length - 1;
            const isCollapsedOnMobile = hasCollapsibleMiddle && !isFirst && !isLast;

            return (
              <li
                key={item.key}
                className={`items-center gap-1 ${isCollapsedOnMobile ? "hidden sm:flex" : "flex"}`}
              >
                {!isFirst && <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/56" />}
                {item.current ? (
                  <span aria-current="page" className="font-medium text-foreground">
                    {item.label}
                  </span>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-sm px-1 py-0.5 ui-motion-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span>{item.label}</span>
                )}
                {/* Reticência decorativa, só entre o primeiro e o último em telas pequenas — nunca
                    substitui os itens reais na árvore de acessibilidade, só o espaço deles. */}
                {isFirst && hasCollapsibleMiddle && (
                  <span aria-hidden="true" className="flex items-center gap-1 sm:hidden">
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground/56" />
                    <span>…</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {breadcrumbsJsonLd && (
        <script
          type="application/ld+json"
          // JSON-LD só pode ir pro DOM assim. Os rótulos vêm de conteúdo editado por usuários
          // (título de entry, nome de arquivo) — serializeJsonLd escapa `<` pra não fechar a tag.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbsJsonLd) }}
        />
      )}
    </>
  );
}
