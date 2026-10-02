import { notFound } from "next/navigation";
import { getCachedEntry, getEntryComposition } from "@/contexts/cms";
import { listBlockDefinitions } from "@/platform/page-builder/block-registry";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { getCmsPageData } from "@/platform/admin-shell/get-cms-page-data";
import { BlockRenderer } from "@/components/page-builder/block-renderer";
import { readEntryPageLayout } from "@/contexts/cms/contracts/page-layout";
import type { ResolvedThemeDefinition, ThemeText } from "@/contexts/themes/contracts/v8";
import { withThemePresentationFields } from "@/platform/page-builder/with-theme-presentation-fields";
import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { CompositionBuilder } from "./_components/composition-builder";
import { PageLayoutPanel } from "./_components/page-layout-panel";

// ThemeText do manifesto → texto (catálogo do tema em pt-BR; sem tradução, a própria chave).
function themeTextResolver(theme: ResolvedThemeDefinition) {
  const catalog = theme.messages["pt-BR"] ?? {};
  return (text: ThemeText) => (typeof text === "string" ? text : (catalog[text.messageKey] ?? text.messageKey));
}

export default async function EntryBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await getCmsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar o CMS.</p>
      </div>
    );
  }

  const canManageEntries = gate.actor.isSuperadmin || gate.actor.permissions.includes("cms.entries.manage");
  if (!canManageEntries) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar entries do CMS.</p>
      </div>
    );
  }

  const [entryResult, compositionResult, activePluginKeys] = await Promise.all([
    getCachedEntry(id),
    getEntryComposition({ id }),
    getActivePluginKeys(),
  ]);

  if (!entryResult.success) {
    return <p className="text-sm text-destructive">Erro ao carregar entry: {entryResult.error.message}</p>;
  }
  const entry = entryResult.data;
  if (!entry) {
    notFound();
  }
  if (!compositionResult.success) {
    return <p className="text-sm text-destructive">Erro ao carregar composição: {compositionResult.error.message}</p>;
  }

  const composition = compositionResult.data ?? [];

  // Tema PÚBLICO ativo (no admin o documento usa o kit, mas preserva a key): as variantes de bloco,
  // os estilos de seção e as variantes de template oferecidas são as dele.
  const document = await resolveDocumentModel();
  const theme = resolveThemeDefinition(document.theme.key).theme;
  const resolveText = themeTextResolver(theme);
  const definitions = withThemePresentationFields(listBlockDefinitions(activePluginKeys), theme.pageBuilder, resolveText);
  const templateOptions = (theme.templateVariants.entry ?? [])
    .filter((variant) => variant.value !== "default")
    .map((variant) => ({ value: variant.value, label: resolveText(variant.label) }));

  return (
    <CompositionBuilder
      entryId={entry.id}
      entryTitle={entry.title}
      entrySlug={entry.slug}
      initialComposition={composition}
      definitions={definitions}
      preview={<BlockRenderer blocks={composition} mode="edit" themeKey={theme.key} />}
      layoutPanel={
        <PageLayoutPanel
          entryId={entry.id}
          initialLayout={readEntryPageLayout(entry.data)}
          templateOptions={templateOptions}
          themeLabel={theme.manifest.name}
        />
      }
    />
  );
}
