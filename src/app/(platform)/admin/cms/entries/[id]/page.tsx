import Link from "next/link";
import { notFound } from "next/navigation";
import { extractEntryComposition, getCachedEntry, getEntryBody, listCategoriesForAdmin, listContentTypes } from "@/contexts/cms";
import { getMediaAsset } from "@/contexts/media";
import { getCmsPageData } from "@/platform/admin-shell/get-cms-page-data";
import { EditEntryForm } from "./_components/edit-entry-form";
import { PublishButton } from "./_components/publish-button";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await getCmsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar o conteúdo do site.</p>
      </div>
    );
  }

  const canManageEntries = gate.actor.isSuperadmin || gate.actor.permissions.includes("cms.entries.manage");
  if (!canManageEntries) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar o conteúdo do site.</p>
      </div>
    );
  }

  const [entryResult, categoriesResult, contentTypesResult] = await Promise.all([
    getCachedEntry(id),
    listCategoriesForAdmin(),
    listContentTypes(),
  ]);

  if (!entryResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar este conteúdo agora. Tente recarregar a página.</p>;
  }
  if (!categoriesResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar as categorias agora. Tente recarregar a página.</p>;
  }
  if (!contentTypesResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar as tags agora. Tente recarregar a página.</p>;
  }

  const entry = entryResult.data;
  if (!entry) {
    notFound();
  }

  const mediaResult = entry.mediaId ? await getMediaAsset({ id: entry.mediaId }) : null;
  const media = mediaResult?.success && mediaResult.data ? mediaResult.data : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Editar conteúdo</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/cms/entries/${entry.id}/builder`}
            className="rounded-sm text-sm text-primary outline-none ui-motion-base hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Editor visual
          </Link>
          <span className="text-sm text-muted-foreground/56">{entry.status === "published" ? "Publicado" : "Rascunho"}</span>
        </div>
      </div>

      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <EditEntryForm
          entryId={entry.id}
          title={entry.title}
          slug={entry.slug}
          body={getEntryBody(entry.data)}
          hasComposition={extractEntryComposition(entry.data) !== null}
          categoryId={entry.categoryId}
          contentTypeIds={entry.contentTypeIds}
          visibility={entry.visibility}
          media={media}
          categories={categoriesResult.data}
          contentTypes={contentTypesResult.data}
        />
      </div>

      {entry.status === "draft" && (
        <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
          <p className="mb-3 text-sm text-muted-foreground">
            Este conteúdo ainda é um rascunho — só fica visível no site depois de publicado.
          </p>
          <PublishButton entryId={entry.id} />
        </div>
      )}
    </div>
  );
}
