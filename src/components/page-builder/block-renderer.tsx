import type { ReactNode } from "react";
import { isBlockConfigured, type Block, type Composition } from "@/contexts/cms";
import type { ResolvedThemeDefinition, ThemeBlockRenderers } from "@/contexts/themes/contracts/v8";
import { pluginKeyForBlockKey, resolveBlockDefinition } from "@/platform/page-builder/block-registry";
import { resolveBlockRenderer, type BlockPresentation, type BlockRenderMode } from "@/platform/page-builder/block-renderers";
import { PageLayoutMarker } from "@/platform/page-builder/page-layout-marker";
import { SECTION_BLOCK_KEY } from "@/platform/page-builder/blocks/section";
import { loadThemeBlockRenderers, resolveSectionStyle } from "@/platform/page-builder/theme-block-renderers";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";

export type { BlockRenderMode };

function isDev() {
  return process.env.NODE_ENV !== "production";
}

// Bloco desconhecido (key sem definition resolvível, ou sem renderer resolvível) não deve
// derrubar a página em produção — entries com composição de um plugin desativado, ou de uma
// versão futura do editor, ainda precisam renderizar o resto. Em dev, um aviso discreto ajuda
// a notar o problema cedo.
function UnknownBlockWarning({ blockKey }: { blockKey: string }) {
  if (!isDev()) {
    return null;
  }
  return (
    <div className="rounded border border-dashed border-destructive/50 p-2 text-xs text-destructive">
      Bloco desconhecido: {blockKey}
    </div>
  );
}

function UnconfiguredBlockPlaceholder({ label, missingMessage }: { label: string; missingMessage: string }) {
  return (
    <div className="rounded border border-dashed border-border p-3 text-xs">
      <p className="font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-muted-foreground/56">{missingMessage}</p>
    </div>
  );
}

// Contexto resolvido UMA vez por árvore de render.
type RenderContext = {
  mode: BlockRenderMode;
  activePluginKeys: ReadonlySet<string>;
  // Renderers do tema por (bloco, variante) — mapa separado do cachedRenderers do core.
  themeRenderers: ThemeBlockRenderers;
  pageBuilder: ResolvedThemeDefinition["pageBuilder"];
};

// themeKey: tema cujos renderers/estilos de seção valem (galeria/preview passam explícito); ausente,
// é o tema do documento (seção/preview/rascunho já aplicados — no admin, o tema público ativo,
// porque toKitAdminDefinition preserva a key).
export async function BlockRenderer({ blocks, mode, themeKey }: { blocks: Composition; mode: BlockRenderMode; themeKey?: string }) {
  // Resolvido uma vez por árvore de render: um bloco cuja key pertence a um plugin hoje
  // desativado não renderiza (nem no público, nem no preview do builder) — trata-se como bloco
  // desconhecido, mesma degradação graciosa de uma key sem definition. registerPlugins() por
  // trás tem cache curto próprio.
  const activePluginKeys = await getActivePluginKeys();
  const key = themeKey ?? (await resolveDocumentModel()).theme.key;
  const theme = resolveThemeDefinition(key).theme;
  const themeRenderers = await loadThemeBlockRenderers(theme.key === key ? key : undefined);
  const context: RenderContext = { mode, activePluginKeys, themeRenderers, pageBuilder: theme.pageBuilder };
  return (
    <>
      {/* Marcador do layout da página (page-layout.css) — só no público, uma vez por página. */}
      {mode === "published" && themeKey === undefined ? <PageLayoutMarker /> : null}
      {await renderBlocks(blocks, context)}
    </>
  );
}

async function renderBlocks(blocks: Composition, context: RenderContext): Promise<ReactNode[]> {
  return Promise.all(blocks.map((block) => renderBlock(block, context)));
}

// Chaves planas em block.data (spec §4.5 — o tipo Block não muda). "default"/vazio = sem variante.
export function blockPresentation(block: Block, pageBuilder: ResolvedThemeDefinition["pageBuilder"]): BlockPresentation {
  const rawVariant = block.data.presentationVariant;
  const variant = typeof rawVariant === "string" && rawVariant.length > 0 && rawVariant !== "default" ? rawVariant : null;
  const sectionStyle = block.key === SECTION_BLOCK_KEY ? resolveSectionStyle(block.data.sectionStyle, pageBuilder) : null;
  return { variant, sectionStyle };
}

async function renderBlock(block: Block, context: RenderContext): Promise<ReactNode> {
  const { mode, activePluginKeys } = context;
  const owningPluginKey = pluginKeyForBlockKey(block.key);
  if (owningPluginKey && !activePluginKeys.has(owningPluginKey)) {
    return <UnknownBlockWarning key={block.id} blockKey={block.key} />;
  }

  const definition = resolveBlockDefinition(block.key);
  if (!definition) {
    return <UnknownBlockWarning key={block.id} blockKey={block.key} />;
  }

  if (!isBlockConfigured(definition, block.data)) {
    if (mode === "published") {
      return null;
    }
    return (
      <UnconfiguredBlockPlaceholder
        key={block.id}
        label={definition.label}
        missingMessage={definition.missingConfigMessage ?? "Bloco não configurado."}
      />
    );
  }

  const Renderer = await resolveBlockRenderer(block.key);
  if (!Renderer) {
    return <UnknownBlockWarning key={block.id} blockKey={block.key} />;
  }

  const presentation = blockPresentation(block, context.pageBuilder);
  const props = {
    block,
    mode,
    presentation,
    renderBlocks: (children: Composition) => renderBlocks(children, context),
  };

  // Variante pedida + renderer do tema pra ela → o tema renderiza, recebendo o core como
  // `Default` (embrulha ou substitui). Variante desconhecida (ou tema sem renderer) → core.
  const ThemeRenderer = presentation.variant ? context.themeRenderers[block.key]?.[presentation.variant] : undefined;
  if (ThemeRenderer) {
    return <ThemeRenderer key={block.id} {...props} variant={presentation.variant!} Default={Renderer} />;
  }
  return <Renderer key={block.id} {...props} />;
}
