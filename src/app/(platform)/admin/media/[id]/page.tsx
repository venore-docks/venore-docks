import { notFound } from "next/navigation";
import Link from "next/link";
import { getMediaAsset, listCategories } from "@/contexts/media";
import { getMediaPageData } from "@/platform/admin-shell/get-media-page-data";
import { collectMediaUsage } from "@/platform/media-usage/media-usage-registry";
import { DeleteMediaButton } from "../_components/delete-media-button";
import { VisibilityToggle } from "./_components/visibility-toggle";
import { CategorySelect } from "./_components/category-select";
import { UsageList } from "./_components/usage-list";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getMediaPageData();
  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar mídia.</p>
      </div>
    );
  }

  const { id } = await params;

  const [mediaResult, categoriesResult, usage] = await Promise.all([
    getMediaAsset({ id }),
    listCategories(),
    collectMediaUsage(id),
  ]);

  if (!mediaResult.success || !mediaResult.data) {
    notFound();
  }

  const media = mediaResult.data;
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const isImage = media.contentType.startsWith("image/");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{media.filename}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatSize(media.size)} · {media.contentType} · enviado em {formatDate(media.createdAt, DEFAULT_DATE_LOCALE, "short")}
          </p>
        </div>
        <Link href="/admin/media" className="text-xs font-medium text-muted-foreground outline-none hover:underline">
          Voltar para Mídia
        </Link>
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <div className="flex h-64 items-center justify-center overflow-hidden rounded-md bg-muted">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt={media.filename} className="h-full w-full object-contain" />
          ) : (
            <a href={media.url} target="_blank" rel="noreferrer" className="text-sm text-foreground underline">
              Abrir arquivo
            </a>
          )}
        </div>
      </section>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Visibilidade</h2>
        <div className="mt-2">
          <VisibilityToggle id={media.id} visibility={media.visibility} />
        </div>
      </section>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Categoria</h2>
        <div className="mt-2">
          <CategorySelect id={media.id} categoryId={media.categoryId} categories={categories} />
        </div>
      </section>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Usado em</h2>
        <div className="mt-2">
          <UsageList usage={usage} />
        </div>
      </section>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Excluir</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Excluir este arquivo é permanente. Se ele estiver em uso, você verá quantos locais serão afetados antes de confirmar.
        </p>
        <div className="mt-2">
          <DeleteMediaButton id={media.id} label="Excluir arquivo" redirectTo="/admin/media" />
        </div>
      </section>
    </div>
  );
}
