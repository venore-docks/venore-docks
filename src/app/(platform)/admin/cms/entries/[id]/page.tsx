import Link from "next/link";
import { notFound } from "next/navigation";
import {
  extractEntryComposition,
  getCachedEntry,
  getEntryBody,
  isEntrySpeechEnabled,
  listCategoriesForAdmin,
  listContentTypes,
  listEntryRevisions,
} from "@/contexts/cms";
import { getMediaAsset } from "@/contexts/media";
import { getSpeechProgress, readSpeechSettings, type SpeechProgress } from "@/contexts/speech";
import { cmsEntrySpeechScope } from "@/platform/speech/cms-entry-scope";
import { getCmsPageData } from "@/platform/admin-shell/get-cms-page-data";
import { EditEntryForm } from "./_components/edit-entry-form";
import { PublishButton } from "./_components/publish-button";
import { RevisionHistory, type RevisionHistoryItem } from "./_components/revision-history";
import { PreviewLink } from "./_components/preview-link";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

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

  // Situação do áudio (opção "Gerar áudio" da edição; geração em platform/speech).
  const speechEnabled = isEntrySpeechEnabled(entry.data);
  let speechStatus: string | null = null;
  let speechProgress: SpeechProgress | null = null;
  if (speechEnabled) {
    const scope = cmsEntrySpeechScope(entry.id);
    const [settings, progress] = await Promise.all([readSpeechSettings(), getSpeechProgress({ scopes: [scope] })]);
    speechProgress = progress.success ? (progress.data[scope] ?? null) : null;
    const ready = (speechProgress?.ready ?? 0) > 0;
    if (!settings.enabled) speechStatus = "A leitura em voz alta está desligada em Editorial → Áudios: nada é gerado até ligar lá.";
    else if (ready) speechStatus = "Áudio pronto: o botão de ouvir já aparece no site.";
    else if (entry.visibility !== "public") speechStatus = "Conteúdo fechado (só logados) não ganha áudio.";
    else if (entry.status !== "published") speechStatus = "O áudio será gerado quando o conteúdo for publicado.";
    else if (speechProgress?.processing) speechStatus = "Gerando o áudio agora.";
    else if (speechProgress?.failed) speechStatus = "A geração falhou. Tente de novo em Editorial → Áudios.";
    else speechStatus = "Na fila: o áudio fica pronto quando o worker passar (acompanhe em Editorial → Áudios).";
  }

  const revisionsResult = await listEntryRevisions({ entryId: entry.id });
  const revisions = revisionsResult.success ? revisionsResult.data.revisions : [];
  const canPublish = revisionsResult.success && revisionsResult.data.canPublish;
  const pendingProposals = revisions.filter((revision) => revision.kind === "proposal" && revision.status === "pending").length;
  const historyItems: RevisionHistoryItem[] = revisions.map((revision) => ({
    id: revision.id,
    kind: revision.kind,
    status: revision.status,
    title: revision.title,
    createdAt: formatDate(revision.createdAt, DEFAULT_DATE_LOCALE, "dateTime") ?? "",
    authorLabel: revision.createdBy === gate.actor.id ? "você" : "outra pessoa da equipe",
    isOwnProposal: revision.createdBy === gate.actor.id,
  }));

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
          speech={{ enabled: speechEnabled, status: speechStatus, progress: speechProgress }}
          media={media}
          categories={categoriesResult.data}
          contentTypes={contentTypesResult.data}
        />
      </div>

      {pendingProposals > 0 && (
        <p className="rounded-control border border-border bg-accent/14 px-3 py-2 text-sm text-foreground">
          {pendingProposals === 1 ? "Há 1 proposta de alteração" : `Há ${pendingProposals} propostas de alteração`} aguardando revisão
          {canPublish ? " — veja o histórico abaixo." : "."}
        </p>
      )}

      {entry.status === "draft" && (
        <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
          <p className="mb-3 text-sm text-muted-foreground">
            Este conteúdo ainda é um rascunho — só fica visível no site depois de publicado.
          </p>
          <PublishButton entryId={entry.id} />
        </div>
      )}

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Link de pré-visualização</h2>
        <p className="mb-3 text-sm text-muted-foreground">Compartilhe a versão atual com quem não tem acesso ao admin, antes de publicar.</p>
        <PreviewLink entryId={entry.id} />
      </section>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Histórico e propostas</h2>
        <RevisionHistory entryId={entry.id} items={historyItems} canPublish={canPublish} />
      </section>
    </div>
  );
}
