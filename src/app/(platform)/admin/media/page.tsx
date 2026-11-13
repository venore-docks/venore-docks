import Link from "next/link";
import { HardDrive, ImageOff, SearchX, Trash2 } from "lucide-react";
import {
  getMediaLibraryStats,
  listCategories,
  listMediaAssets,
  MEDIA_KINDS,
  MEDIA_SORTS,
  pickMediaVariantUrl,
  type MediaKind,
  type MediaSort,
  type MediaVisibility,
} from "@/contexts/media";
import { getMediaPageData } from "@/platform/admin-shell/get-media-page-data";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PaginationLinks, parsePageParam } from "@/components/pagination-links";
import { MediaCard, MediaRow, type MediaItemProps } from "./_components/media-item";
import { UploadMediaDialog } from "./_components/upload-media-form";
import { CategorySidebar } from "./_components/category-sidebar";
import { LibraryToolbar } from "./_components/library-toolbar";
import { OptimizeImagesButton } from "./_components/optimize-images-button";
import { formatSize, KIND_LABELS, type LibraryParams } from "./_lib/media-library";

// Import só pelo efeito colateral: dispara o auto-start do sweep de autopurge (blob-spec seção 7)
// na primeira vez que alguém visita a seção de mídia do admin — mesmo mecanismo de
// contexts/media/index.ts importar ./reconciliation. Fica aqui (não no barrel do context) porque
// o job depende de collectMediaUsage, que atravessa cms/brand/academy — media não pode depender
// disso (regra 12), então o job mora em platform/media-lifecycle/, fora do context.
import "@/platform/media-lifecycle/sweep-soft-deleted-media";

const PAGE_SIZE = 60;
const VISIBILITIES: readonly MediaVisibility[] = ["public", "private", "restricted"];

function pickOne<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function MediaAdminPage({
  searchParams,
}: {
  searchParams: Promise<LibraryParams>;
}) {
  const gate = await getMediaPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar mídia.</p>
      </div>
    );
  }

  const params = await searchParams;
  const page = parsePageParam(params.page);
  const kind: MediaKind | undefined = pickOne(params.kind, MEDIA_KINDS);
  const visibility: MediaVisibility | undefined = pickOne(params.visibility, VISIBILITIES);
  const sort: MediaSort | undefined = pickOne(params.sort, MEDIA_SORTS);
  const search = params.q?.trim().slice(0, 100) || undefined;
  const view = params.view === "list" ? "list" : "grid";

  // Página + 1 item pra saber se há próxima (sem COUNT).
  const [mediaResult, categoriesResult, statsResult] = await Promise.all([
    listMediaAssets({
      ...(params.category ? { categoryId: params.category } : {}),
      ...(search ? { search } : {}),
      ...(kind ? { kind } : {}),
      ...(visibility ? { visibility } : {}),
      ...(sort ? { sort } : {}),
      limit: PAGE_SIZE + 1,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listCategories(),
    getMediaLibraryStats(),
  ]);

  if (!mediaResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar a mídia agora. Tente recarregar a página.</p>;
  }

  const categories = categoriesResult.success ? categoriesResult.data : [];
  const stats = statsResult.success
    ? statsResult.data
    : {
        total: 0,
        uncategorized: 0,
        byCategory: {},
        byKind: { image: 0, video: 0, audio: 0, document: 0 },
        byVisibility: { public: 0, restricted: 0, private: 0 },
        totalSize: 0,
      };
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const hasNextPage = mediaResult.data.length > PAGE_SIZE;
  const assets = mediaResult.data.slice(0, PAGE_SIZE);
  const hasPurgeAccess = gate.actor.isSuperadmin || gate.actor.permissions.includes("media.purge");

  const activeCategoryId = params.category && params.category !== "none" ? params.category : undefined;
  const activeCategoryName =
    params.category === "none" ? "Sem categoria" : activeCategoryId ? categoryNameById.get(activeCategoryId) : undefined;
  const hasFilters = Boolean(search || kind || visibility);

  const currentParams: LibraryParams = {
    category: params.category,
    q: search,
    kind,
    visibility,
    sort,
    view: view === "list" ? "list" : undefined,
  };

  const shownLabel = `${page > 1 ? `Página ${page} · ` : ""}${pluralize(assets.length, "arquivo", "arquivos")}${hasNextPage ? "+" : ""}${
    activeCategoryName ? ` em ${activeCategoryName}` : ""
  }`;

  const items: MediaItemProps[] = assets.map((asset) => ({
    id: asset.id,
    filename: asset.filename,
    // Miniatura de ~250px: a variante, não o original de vários MB.
    url: pickMediaVariantUrl(asset, 240),
    contentType: asset.contentType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt.toISOString(),
    visibility: asset.visibility,
    categoryId: asset.categoryId,
    categoryName: asset.categoryId ? (categoryNameById.get(asset.categoryId) ?? null) : null,
    categories,
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Mídia</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as imagens, vídeos, áudios e documentos do site, organizados por categoria.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <HardDrive className="size-3.5" aria-hidden="true" />
              {pluralize(stats.total, "arquivo", "arquivos")} · {formatSize(stats.totalSize)}
            </span>
            {MEDIA_KINDS.filter((key) => stats.byKind[key] > 0).map((key) => (
              <span key={key}>
                {stats.byKind[key]} {KIND_LABELS[key].toLowerCase()}
              </span>
            ))}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
          <OptimizeImagesButton />
          {hasPurgeAccess && (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/admin/media/trash">
                <Trash2 className="size-4" strokeWidth={2} />
                Lixeira
              </Link>
            </Button>
          )}
          <UploadMediaDialog categories={categories} {...(activeCategoryId ? { defaultCategoryId: activeCategoryId } : {})} />
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <CategorySidebar
          categories={categories}
          params={currentParams}
          total={stats.total}
          uncategorized={stats.uncategorized}
          countByCategory={stats.byCategory}
        />

        <section className="min-w-0 flex-1 space-y-4" aria-label="Arquivos">
          <LibraryToolbar
            params={currentParams}
            kindCounts={stats.byKind}
            visibilityCounts={stats.byVisibility}
            resultLabel={shownLabel}
          />

          {items.length === 0 ? (
            hasFilters || params.category ? (
              <EmptyState
                icon={<SearchX className="size-8" strokeWidth={1.5} />}
                title="Nenhum arquivo encontrado"
                description="Nenhum arquivo corresponde a esta categoria e aos filtros escolhidos. Tente limpar os filtros ou buscar por outro nome."
              />
            ) : (
              <EmptyState
                icon={<ImageOff className="size-8" strokeWidth={1.5} />}
                title="Nenhum arquivo enviado ainda"
                description='Use "Enviar arquivos" para adicionar imagens e documentos que poderão ser usados em páginas e conteúdos.'
              />
            )
          ) : view === "list" ? (
            <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
              {items.map((item) => (
                <MediaRow key={item.id} {...item} />
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {items.map((item) => (
                <MediaCard key={item.id} {...item} />
              ))}
            </div>
          )}

          <PaginationLinks
            basePath="/admin/media"
            params={{
              category: params.category,
              q: search,
              kind,
              visibility,
              sort,
              view: view === "list" ? "list" : undefined,
            }}
            page={page}
            hasNextPage={hasNextPage}
          />
        </section>
      </div>
    </div>
  );
}
