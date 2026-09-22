import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Calendar } from "lucide-react";
import {
  getCachedCategoryBySlug,
  getCachedPublishedEntryBySlug,
  getEntryBody,
  getEntryComposition,
  listEntries,
  recordEntryView,
} from "@/contexts/cms";
import type { Block, EntryRecord } from "@/contexts/cms";
import { getCurrentUser } from "@/contexts/auth";
import { getMediaAsset } from "@/contexts/media";
import { resolvePublicPluginRoute } from "@/platform/plugin-routing/resolve-public-route";
import { BlockRenderer } from "@/components/page-builder/block-renderer";
import { EmptyState } from "@/components/empty-state";

// force-dynamic: mesmo motivo de app/page.tsx — conteúdo e tema ativo mudam em runtime.
export const dynamic = "force-dynamic";

// C7: "authenticated" nunca aparece pra visitante sem sessão — nem como entry única (notFound),
// nem como item de listagem (BL1: filtrado antes de renderizar, não link que ia dar 404).
async function isVisibleToCurrentViewer(entry: EntryRecord): Promise<boolean> {
  if (entry.visibility === "public") return true;
  const currentUser = await getCurrentUser();
  return currentUser.success && Boolean(currentUser.data);
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function textFromRichTextNode(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  if (record.type === "text" && typeof record.text === "string") return record.text;
  if (Array.isArray(record.content)) return record.content.map(textFromRichTextNode).join(" ");
  return "";
}

// Entries não têm campo de resumo dedicado (só corpo estruturado em blocos) — o blogroll deriva
// um preview em texto puro do primeiro bloco de rich text da composição, em vez de exigir que o
// autor mantenha um resumo duplicado em dois lugares.
function extractExcerpt(composition: Block[] | null, maxLength = 160): string | null {
  if (!composition) return null;

  function walk(blocks: Block[]): string | null {
    for (const block of blocks) {
      if (block.key === "core.content.richtext") {
        const content = (block.data as { content?: unknown }).content;
        if (content && typeof content === "object") {
          const text = textFromRichTextNode(content).replace(/\s+/g, " ").trim();
          if (text) return text;
        }
      }
      for (const area of block.areas ?? []) {
        const found = walk(area.blocks);
        if (found) return found;
      }
    }
    return null;
  }

  const text = walk(composition);
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

// BL1 (docs/implementation-roadmap.md, Fase 4): rota de categoria em formato blog — lista as
// entries publicadas daquela categoria, respeitando status (listEntries já filtra
// status="published") e visibilidade por entry (C7). Capa do card vem de entry.mediaId (campo
// dedicado de "imagem de destaque", exposto no form de edição da entry via MediaPickerField) —
// não da composição, pra não depender de onde o autor colocou a imagem dentro do corpo.
async function renderCategoryBlogroll(category: { id: string; name: string; slug: string; description: string | null }) {
  const entriesResult = await listEntries({ categoryId: category.id });
  const allEntries = entriesResult.success ? entriesResult.data : [];

  const visibleFlags = await Promise.all(allEntries.map(isVisibleToCurrentViewer));
  const visibleEntries = allEntries.filter((_, index) => visibleFlags[index]);
  const sorted = [...visibleEntries].sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );

  const cards = await Promise.all(
    sorted.map(async (entry) => {
      const [coverResult, compositionResult] = await Promise.all([
        entry.mediaId ? getMediaAsset({ id: entry.mediaId }) : Promise.resolve(null),
        getEntryComposition({ id: entry.id }),
      ]);
      const coverUrl = coverResult?.success ? (coverResult.data?.url ?? null) : null;
      const composition = compositionResult.success ? compositionResult.data : null;
      return { entry, coverUrl, excerpt: extractExcerpt(composition) };
    }),
  );

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
    </div>
  );
}

export default async function CatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug: segments } = await params;

  // Rota de plugin (ex: /academy, /birthdays, /donations) sempre tem precedência sobre conteúdo
  // do CMS de mesmo slug — mesmo comportamento de quando cada uma era uma pasta literal em
  // app/(platform)/**, reservando o slug antes do catch-all existir sequer. Plugin registrado mas
  // desativado, ou sub-rota que não casou, vira notFound() direto — nunca cai pra procurar
  // conteúdo do CMS com aquele slug (ver comentário em resolve-public-route.ts).
  const pluginRoute = await resolvePublicPluginRoute(segments);
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
      return renderCategoryBlogroll(categoryResult.data);
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

  const compositionResult = await getEntryComposition({ id: entry.id });
  const composition = compositionResult.success ? compositionResult.data : null;
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
