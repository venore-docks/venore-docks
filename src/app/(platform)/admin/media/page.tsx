import Link from "next/link";
import { ImageOff, Trash2 } from "lucide-react";
import { listCategories, listMediaAssets, pickMediaVariantUrl } from "@/contexts/media";
import { getMediaPageData } from "@/platform/admin-shell/get-media-page-data";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PaginationLinks, parsePageParam } from "@/components/pagination-links";
import { MediaItem } from "./_components/media-item";
import { UploadMediaForm } from "./_components/upload-media-form";
import { CategoryFilter } from "./_components/category-filter";
import { ManageCategories } from "./_components/manage-categories";
import { OptimizeImagesButton } from "./_components/optimize-images-button";

// Import só pelo efeito colateral: dispara o auto-start do sweep de autopurge (blob-spec seção 7)
// na primeira vez que alguém visita a seção de mídia do admin — mesmo mecanismo de
// contexts/media/index.ts importar ./reconciliation. Fica aqui (não no barrel do context) porque
// o job depende de collectMediaUsage, que atravessa cms/brand/academy — media não pode depender
// disso (regra 12), então o job mora em platform/media-lifecycle/, fora do context.
import "@/platform/media-lifecycle/sweep-soft-deleted-media";

const PAGE_SIZE = 60;

export default async function MediaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
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

  const { category: categoryId, page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);

  // Página + 1 item pra saber se há próxima (sem COUNT).
  const [mediaResult, categoriesResult] = await Promise.all([
    listMediaAssets({ ...(categoryId ? { categoryId } : {}), limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
    listCategories(),
  ]);

  if (!mediaResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar a mídia agora. Tente recarregar a página.</p>;
  }

  const categories = categoriesResult.success ? categoriesResult.data : [];
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const hasNextPage = mediaResult.data.length > PAGE_SIZE;
  const assets = mediaResult.data.slice(0, PAGE_SIZE);
  const hasPurgeAccess = gate.actor.isSuperadmin || gate.actor.permissions.includes("media.purge");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mídia</h1>
          <p className="mt-1 text-sm text-muted-foreground">Envie e gerencie as imagens e arquivos usados no conteúdo do site.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
          <OptimizeImagesButton />
          {hasPurgeAccess && (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/admin/media/trash">
                <Trash2 className="size-4" strokeWidth={2} />
                Lixeira
              </Link>
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Enviar arquivo</h2>
        <div className="mt-3">
          <UploadMediaForm />
        </div>
      </section>

      <ManageCategories categories={categories} />

      <div className="flex items-center justify-between">
        <CategoryFilter categories={categories} />
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={<ImageOff className="size-8" strokeWidth={1.5} />}
          title="Nenhum arquivo enviado ainda"
          description="Envie uma imagem acima para poder usá-la em páginas e conteúdos."
        />
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((asset) => (
            <MediaItem
              key={asset.id}
              id={asset.id}
              filename={asset.filename}
              // Miniatura de ~250px: a variante, não o original de vários MB.
              url={pickMediaVariantUrl(asset, 240)}
              contentType={asset.contentType}
              size={asset.size}
              createdAt={asset.createdAt.toISOString()}
              visibility={asset.visibility}
              categoryName={asset.categoryId ? (categoryNameById.get(asset.categoryId) ?? null) : null}
            />
          ))}
        </section>
      )}

      <PaginationLinks basePath="/admin/media" params={{ category: categoryId }} page={page} hasNextPage={hasNextPage} />
    </div>
  );
}
