import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Calendar } from "lucide-react";
import {
  extractEntryComposition,
  getCachedCategoryBySlug,
  getCachedPublishedEntryBySlug,
  getEntryBody,
  listEntries,
  recordEntryView,
} from "@/contexts/cms";
import type { EntryRecord } from "@/contexts/cms";
import { getCurrentUser } from "@/contexts/auth";
import { getMediaAssetUrls } from "@/contexts/media";
import { resolvePublicPluginRoute } from "@/platform/plugin-routing/resolve-public-route";
import { BlockRenderer } from "@/components/page-builder/block-renderer";
import { EmptyState } from "@/components/empty-state";
import { extractExcerpt } from "@/platform/seo/entry-excerpt";

// force-dynamic: mesmo motivo de app/page.tsx — conteúdo e tema ativo mudam em runtime.
export const dynamic = "force-dynamic";

type CatchAllProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// generateMetadata e a página resolvem a MESMA rota de plugin no mesmo request — cache() evita
// ler o registro de plugins ativos (registerPlugins, sem cache próprio) duas vezes. Chave em JSON
// (não join("/")) porque um segmento decodificado pode conter "/".
const resolvePublicPluginRouteForRequest = cache((segmentsKey: string) =>
  resolvePublicPluginRoute(JSON.parse(segmentsKey) as string[]),
);

// Só rota de plugin com generateMetadata na route-table (ex: página pública de um jogo do
// erasto-league, com a capa como imagem de compartilhamento) sobrescreve algo aqui — o resto
// continua herdando o metadata do layout raiz, como antes. Erro no metadata de um plugin não
// derruba a página: cai pro metadata herdado (a própria página decide se renderiza ou falha);
// notFound()/redirect() internos do Next continuam valendo (unstable_rethrow).
export async function generateMetadata({ params, searchParams }: CatchAllProps): Promise<Metadata> {
  const { slug: segments } = await params;
  const pluginRoute = await resolvePublicPluginRouteForRequest(JSON.stringify(segments));
  if (pluginRoute.kind === "not-a-plugin-route") {
    return generateCmsMetadata(segments);
  }
  if (pluginRoute.kind !== "matched" || !pluginRoute.generateMetadata) {
    return {};
  }
  try {
    return await pluginRoute.generateMetadata({ params: Promise.resolve(pluginRoute.params), searchParams });
  } catch (error) {
    unstable_rethrow(error);
    console.warn(`[plugin-routing] generateMetadata de "/${segments.join("/")}" falhou — usando o metadata herdado.`, error);
    return {};
  }
}

const isViewerAuthenticated = cache(async (): Promise<boolean> => {
  const currentUser = await getCurrentUser();
  return currentUser.success && Boolean(currentUser.data);
});

// <head> das páginas do CMS: título, resumo (primeiro rich text), capa como og:image, canonical.
// Conteúdo "authenticated" sai com noindex — mesmo pra quem está logado vendo a página.
async function generateCmsMetadata(segments: string[]): Promise<Metadata> {
  if (segments.length === 0 || segments.length > 2) return {};

  const categoryResult = await getCachedCategoryBySlug(segments[0]);
  const category = categoryResult.success ? categoryResult.data : null;
  if (segments.length === 1 && category) {
    return {
      title: category.name,
      description: category.description ?? undefined,
      alternates: { canonical: `/${category.slug}`, types: { "application/rss+xml": `/rss.xml?category=${category.slug}` } },
    };
  }

  const entryResult =
    segments.length === 1
      ? await getCachedPublishedEntryBySlug(null, segments[0])
      : category
        ? await getCachedPublishedEntryBySlug(category.id, segments[1])
        : null;
  const entry = entryResult?.success ? entryResult.data : null;
  if (!entry) return {};
  // Título/resumo de conteúdo fechado não vai pro <head> de quem não pode ver a página.
  if (!(await isVisibleToCurrentViewer(entry))) return {};

  const description = extractExcerpt(extractEntryComposition(entry.data), 200) ?? undefined;
  const coverResult = entry.mediaId ? await getMediaAssetUrls({ ids: [entry.mediaId] }) : null;
  const coverUrl = entry.mediaId && coverResult?.success ? coverResult.data[entry.mediaId] : undefined;
  const path = category && segments.length === 2 ? `/${category.slug}/${entry.slug}` : `/${entry.slug}`;

  return {
    title: entry.title,
    description,
    alternates: { canonical: path },
    robots: entry.visibility === "public" ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: entry.title,
      description,
      url: path,
      publishedTime: entry.publishedAt?.toISOString(),
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
  };
}

// C7: "authenticated" nunca aparece pra visitante sem sessão — nem como entry única (notFound),
// nem como item de listagem (BL1: filtrado antes de renderizar, não link que ia dar 404).
async function isVisibleToCurrentViewer(entry: EntryRecord): Promise<boolean> {
  if (entry.visibility === "public") return true;
  return isViewerAuthenticated();
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

// BL1 (docs/implementation-roadmap.md, Fase 4): rota de categoria em formato blog — lista as
// entries publicadas daquela categoria, respeitando status (listEntries já filtra
// status="published") e visibilidade por entry (C7). Capa do card vem de entry.mediaId (campo
// dedicado de "imagem de destaque", exposto no form de edição da entry via MediaPickerField) —
// não da composição, pra não depender de onde o autor colocou a imagem dentro do corpo.
const BLOGROLL_PAGE_SIZE = 12;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

// Uma consulta de entries (a página pedida + 1, pra saber se há próxima), uma de mídia pra todas
// as capas, e o resumo vem do `data` que a listagem já trouxe. Antes: todas as entries da
// categoria + getMediaAsset + getEntryComposition POR card.
async function renderCategoryBlogroll(
  category: { id: string; name: string; slug: string; description: string | null },
  page: number,
) {
  const viewerIsAuthenticated = await isViewerAuthenticated();
  const entriesResult = await listEntries({
    categoryId: category.id,
    // C7: visitante sem sessão só vê "public" — filtrado no banco, antes da paginação.
    ...(viewerIsAuthenticated ? {} : { visibility: "public" as const }),
    limit: BLOGROLL_PAGE_SIZE + 1,
    offset: (page - 1) * BLOGROLL_PAGE_SIZE,
  });
  const fetched = entriesResult.success ? entriesResult.data : [];
  const hasNextPage = fetched.length > BLOGROLL_PAGE_SIZE;
  const pageEntries = fetched.slice(0, BLOGROLL_PAGE_SIZE);

  const coverIds = pageEntries.map((entry) => entry.mediaId).filter((id): id is string => Boolean(id));
  const coversResult = await getMediaAssetUrls({ ids: coverIds });
  const coverUrls = coversResult.success ? coversResult.data : {};

  const cards = pageEntries.map((entry) => ({
    entry,
    coverUrl: entry.mediaId ? (coverUrls[entry.mediaId] ?? null) : null,
    excerpt: extractExcerpt(extractEntryComposition(entry.data)),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{category.name}</h1>
        {category.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{category.description}</p>}
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-8" strokeWidth={1.5} />}
          title="Nenhum conteúdo publicado nesta categoria ainda"
          description="Volte mais tarde — novos textos aparecem aqui assim que forem publicados."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4 sm:gap-5">
          {cards.map(({ entry, coverUrl, excerpt }) => (
            <Link key={entry.id} href={`/${category.slug}/${entry.slug}`} className="group block">
              <article className="flex h-full flex-col overflow-hidden rounded-panel border border-border bg-card ui-motion-base group-hover:shadow-float">
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- mesmo padrão do resto do page-builder, sem domínio remoto configurado pra next/image
                    <img
                      src={coverUrl}
                      alt=""
                      className="h-full w-full object-cover ui-motion-emphasis group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/56">
                      <BookOpen className="size-8" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {entry.publishedAt && (
                    <p className="flex items-center gap-1 text-[11px] font-medium tracking-caps text-muted-foreground/56 uppercase">
                      <Calendar className="size-3" aria-hidden="true" /> {formatDate(entry.publishedAt)}
                    </p>
                  )}
                  <h2 className="text-base font-semibold text-foreground">{entry.title}</h2>
                  {excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>}
                  <p className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-primary">
                    Ler mais <ArrowRight className="size-3.5" aria-hidden="true" />
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}

      {(page > 1 || hasNextPage) && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? (
            <Link href={page === 2 ? `/${category.slug}` : `/${category.slug}?page=${page - 1}`} className="flex items-center gap-1 font-medium text-primary">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Mais recentes
            </Link>
          ) : (
            <span />
          )}
          {hasNextPage && (
            <Link href={`/${category.slug}?page=${page + 1}`} className="flex items-center gap-1 font-medium text-primary">
              Mais antigos <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export default async function CatchAllPage({ params, searchParams }: CatchAllProps) {
  const { slug: segments } = await params;

  // Rota de plugin (ex: /academy, /birthdays, /donations) sempre tem precedência sobre conteúdo
  // do CMS de mesmo slug — mesmo comportamento de quando cada uma era uma pasta literal em
  // app/(platform)/**, reservando o slug antes do catch-all existir sequer. Plugin registrado mas
  // desativado, ou sub-rota que não casou, vira notFound() direto — nunca cai pra procurar
  // conteúdo do CMS com aquele slug (ver comentário em resolve-public-route.ts).
  const pluginRoute = await resolvePublicPluginRouteForRequest(JSON.stringify(segments));
  if (pluginRoute.kind === "reserved-not-found") {
    notFound();
  }
  if (pluginRoute.kind === "matched") {
    const { Component, params: routeParams } = pluginRoute;
    return <Component params={Promise.resolve(routeParams)} searchParams={searchParams} />;
  }

  // "home" só existe canonicamente em "/" — sem isso, /home renderizaria o mesmo conteúdo da
  // home num segundo endereço (docs/venore-docks.md — decisão de rota pública desta sessão).
  if (segments.length === 1 && segments[0] === "home") {
    notFound();
  }

  let entryResult;
  let backHref = "/";
  let backLabel = "Início";

  if (segments.length === 1) {
    // BL1: categoria tem precedência sobre uma entry raiz de mesmo slug — decisão registrada
    // (docs/implementation-roadmap.md, Fase 4/BL1): o banco não impede as duas existirem com o
    // mesmo slug (índices únicos independentes, ver database/schema/index.ts), então uma ordem
    // determinística era necessária. Categoria só existe pra ser uma seção navegável; uma entry
    // raiz de mesmo slug (caso raro) fica inalcançável por este endereço enquanto a categoria
    // existir.
    const categoryResult = await getCachedCategoryBySlug(segments[0]);
    if (categoryResult.success && categoryResult.data) {
      return renderCategoryBlogroll(categoryResult.data, parsePage((await searchParams).page));
    }

    entryResult = await getCachedPublishedEntryBySlug(null, segments[0]);
  } else if (segments.length === 2) {
    const categoryResult = await getCachedCategoryBySlug(segments[0]);
    if (!categoryResult.success || !categoryResult.data) {
      notFound();
    }
    entryResult = await getCachedPublishedEntryBySlug(categoryResult.data.id, segments[1]);
    backHref = `/${categoryResult.data.slug}`;
    backLabel = categoryResult.data.name;
  } else {
    notFound();
  }

  if (!entryResult.success || !entryResult.data) {
    notFound();
  }

  const entry = entryResult.data;

  // Privacidade por conteúdo (Fase 2/C7): "authenticated" nunca renderiza pra visitante sem
  // sessão — notFound() em vez de redirect pro login, pra não confirmar que existe conteúdo
  // fechado nesse endereço a quem não tem acesso.
  if (!(await isVisibleToCurrentViewer(entry))) {
    notFound();
  }

  recordEntryView(entry.id);

  // A entry publicada já veio com `data` — extrair a composição dali evita um segundo SELECT.
  const composition = extractEntryComposition(entry.data);
  const publishedLabel = formatDate(entry.publishedAt);

  return (
    // Sem max-w/mx-auto próprios: ContentSlot (cada tema) já centra o conteúdo em max-w-6xl e
    // Breadcrumbs.tsx usa a mesma largura — um max-w mais estreito aqui empurrava título/corpo
    // pra dentro de uma coluna ainda mais centrada DENTRO da já centrada, desalinhando com a
    // trilha de breadcrumb acima (a "margem" reportada: título mais à direita que o breadcrumb).
    <article className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground/56 outline-none ui-motion-base hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> {backLabel}
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{entry.title}</h1>
        {publishedLabel && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" /> {publishedLabel}
          </p>
        )}
      </div>

      {composition ? <BlockRenderer blocks={composition} mode="published" /> : <p className="text-muted-foreground">{getEntryBody(entry.data)}</p>}
    </article>
  );
}
