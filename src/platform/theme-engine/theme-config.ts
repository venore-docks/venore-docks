import semver from "semver";
import { listUsers } from "@/contexts/auth";
import { authorizeActor } from "@/contexts/rbac";
import {
  discardThemeDraft,
  exportThemeConfig,
  getPublishedThemeConfig,
  getThemeConfigRevision,
  getThemeDraft,
  importThemeConfig,
  listThemeConfigHistory,
  publishThemeDraft,
  rollbackThemeConfig,
  saveThemeDraft,
  THEME_CONFIG_STORAGE_UNAVAILABLE,
  type ImportThemeConfigResult,
} from "@/contexts/themes";
import { CURRENT_THEME_CONTRACT_VERSION } from "@/contexts/themes/contracts/contract-version";
import {
  defaultThemeConfigDocument,
  parseThemeConfigDocument,
  themeConfigExportEnvelopeSchema,
  type ResolvedThemeDefinition,
  type ThemeConfigDocument,
  type ThemeConfigExportEnvelope,
  type ThemeConfigRevisionView,
} from "@/contexts/themes/contracts/v8";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { signThemeOverride, themeOverrideExpiry } from "@/platform/theme-preview/override-token";
import { loadThemeEnabledCheck } from "@/platform/theme-rendering/theme-enabled-check";
import type { OperationResult } from "@/shared/types";
import { THEME_REGISTRY } from "@/themes/registry";
import { validateThemeConfig, type ThemeConfigValidation } from "./validate-theme-config";

// Ponto de composição do ciclo de vida da config de tema (spec §4.3, §7.2, §7.10) — mesmo papel de
// activate-theme.ts: contexts/themes guarda/publica o documento, mas só platform enxerga o
// registro de temas (src/themes) e o estado de habilitação (contexts/extensions). Toda action e
// route handler de config de tema chama ESTE módulo, nunca o barrel do context direto. A
// autorização (settings.manage) acontece nos handlers do context — aqui nada grava antes deles.

export const THEME_CONFIG_IMPORT_MAX_BYTES = 256 * 1024;

export type SaveThemeConfigDraftInput = { config: unknown; basedOnRevisionId?: string | null; note?: string | null };
export type ThemeConfigDraftWithWarnings = { draft: ThemeConfigRevisionView; warnings: string[] };

function invalidDocument(): OperationResult<never> {
  return { success: false, error: { code: "themes.config.invalid_document", message: "Documento de aparência inválido." } };
}

function firstError(validation: ThemeConfigValidation): OperationResult<never> | null {
  const [error] = validation.errors;
  return error ? { success: false, error } : null;
}

async function validateAgainstRegistry(config: Parameters<typeof validateThemeConfig>[0]): Promise<ThemeConfigValidation> {
  return validateThemeConfig(config, { registry: THEME_REGISTRY, isEnabled: await loadThemeEnabledCheck() });
}

export async function saveThemeConfigDraft(input: SaveThemeConfigDraftInput): Promise<OperationResult<ThemeConfigDraftWithWarnings>> {
  const document = parseThemeConfigDocument(input.config);
  if (!document) return invalidDocument();
  const validation = await validateAgainstRegistry(document);
  const failure = firstError(validation);
  if (failure) return failure;

  const saved = await saveThemeDraft({ config: validation.config, basedOnRevisionId: input.basedOnRevisionId, note: input.note });
  if (!saved.success) return saved;
  return { success: true, data: { draft: saved.data, warnings: validation.warnings } };
}

// Valida o rascunho contra o registro ATUAL antes de publicar (um tema pode ter sido desabilitado
// ou removido depois do salvamento). O que só gera aviso é limpo no rascunho antes da publicação.
export async function publishThemeConfigDraft(): Promise<OperationResult<ThemeConfigDraftWithWarnings>> {
  const draft = await getThemeDraft();
  if (!draft.success) return draft;
  if (!draft.data) return { success: false, error: { code: "themes.config.no_draft", message: "Não há rascunho de aparência para publicar." } };

  const validation = await validateAgainstRegistry(draft.data.config);
  const failure = firstError(validation);
  if (failure) return failure;
  if (validation.warnings.length > 0) {
    const cleaned = await saveThemeDraft({ config: validation.config });
    if (!cleaned.success) return cleaned;
  }

  const published = await publishThemeDraft();
  if (!published.success) return published;
  return { success: true, data: { draft: published.data, warnings: validation.warnings } };
}

export async function rollbackThemeConfigRevision(revisionId: string): Promise<OperationResult<ThemeConfigRevisionView>> {
  const target = await getThemeConfigRevision({ revisionId });
  if (!target.success) return target;
  if (!target.data) return { success: false, error: { code: "themes.config.revision_not_found", message: "Revisão não encontrada no histórico." } };

  const validation = await validateAgainstRegistry(target.data.config);
  const failure = firstError(validation);
  if (failure) return failure;
  return rollbackThemeConfig({ revisionId });
}

export async function exportPublishedThemeConfig(): Promise<OperationResult<ThemeConfigExportEnvelope>> {
  const published = await getPublishedThemeConfig();
  const themeKey = published.success ? published.data.themeKey : null;
  const entry = themeKey ? THEME_REGISTRY[themeKey] : undefined;
  return exportThemeConfig({ themeVersion: entry?.packageVersion ?? entry?.manifest.version });
}

function compatibilityWarnings(envelope: ThemeConfigExportEnvelope): string[] {
  const warnings: string[] = [];
  const exportedMajor = semver.valid(envelope.coreContract) ? semver.major(envelope.coreContract) : null;
  if (exportedMajor !== semver.major(CURRENT_THEME_CONTRACT_VERSION)) {
    warnings.push(`Arquivo exportado pelo contrato de tema ${envelope.coreContract}; este site usa ${CURRENT_THEME_CONTRACT_VERSION}.`);
  }
  const installed = THEME_REGISTRY[envelope.theme.key];
  const installedVersion = installed?.packageVersion ?? installed?.manifest.version;
  if (installed && installedVersion && installedVersion !== envelope.theme.version) {
    warnings.push(`Exportado com ${envelope.theme.key}@${envelope.theme.version}; instalado aqui: ${installedVersion}.`);
  }
  return warnings;
}

// Importação (spec §7.10): arquivo ≤ 256 KB → JSON → zod do envelope → validação contra o
// registro local (tema desconhecido é erro; opção/paleta/variante desconhecida é descartada com
// aviso) → SÓ rascunho (importThemeConfig nunca publica).
export async function importThemeConfigFile(file: unknown): Promise<OperationResult<ImportThemeConfigResult>> {
  if (!file || typeof file !== "object" || typeof (file as Blob).text !== "function" || typeof (file as Blob).size !== "number") {
    return { success: false, error: { code: "themes.config.import_missing_file", message: "Escolha um arquivo .json exportado do Venore." } };
  }
  const blob = file as Blob;
  if (blob.size === 0) return { success: false, error: { code: "themes.config.import_missing_file", message: "O arquivo está vazio." } };
  if (blob.size > THEME_CONFIG_IMPORT_MAX_BYTES) {
    return { success: false, error: { code: "themes.config.import_too_large", message: "O arquivo passa do limite de 256 KB." } };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await blob.text());
  } catch {
    return { success: false, error: { code: "themes.config.import_invalid", message: "O arquivo não é um JSON válido." } };
  }
  const parsed = themeConfigExportEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: {
        code: "themes.config.import_invalid",
        message: `Arquivo de aparência inválido${issue ? ` (${issue.path.join(".") || "raiz"}: ${issue.message})` : ""}.`,
      },
    };
  }
  const envelope = parsed.data as ThemeConfigExportEnvelope;

  const validation = await validateAgainstRegistry(envelope.config);
  const failure = firstError(validation);
  if (failure) return failure;
  const warnings = [...compatibilityWarnings(envelope), ...validation.warnings];
  return importThemeConfig({ envelope: { ...envelope, config: validation.config }, warnings });
}

// Token do cookie de preview do rascunho (spec §7.2), assinado para o ator — só depois de
// autorizar settings.manage e de existir um rascunho. Quem grava o cookie é a action.
export async function issueDraftPreviewToken(): Promise<OperationResult<{ token: string }>> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  const draft = await getThemeDraft();
  if (!draft.success) return draft;
  if (!draft.data) return { success: false, error: { code: "themes.config.no_draft", message: "Salve um rascunho antes de pré-visualizar." } };
  const token = signThemeOverride({ kind: "draft", userId: authz.actorId, revisionId: draft.data.id, exp: themeOverrideExpiry() });
  if (!token) return { success: false, error: { code: "themes.preview.unavailable", message: "Pré-visualização indisponível (AUTH_SECRET ausente)." } };
  return { success: true, data: { token } };
}

// Token do safe mode (spec §7.2): Slime só para este admin, por até 2 h.
export async function issueSafeModeToken(): Promise<OperationResult<{ token: string }>> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  const token = signThemeOverride({ kind: "safe-mode", userId: authz.actorId, exp: themeOverrideExpiry() });
  if (!token) return { success: false, error: { code: "themes.preview.unavailable", message: "Modo seguro indisponível (AUTH_SECRET ausente)." } };
  return { success: true, data: { token } };
}

export async function discardThemeConfigDraft(): Promise<OperationResult<{ discarded: boolean }>> {
  return discardThemeDraft();
}

// Fatia serializável (sem componentes/funções) da definição resolvida — o que os painéis do
// Personalizar precisam (customize/_panels/types.ts: ResolvedThemeDefinitionView).
export type ThemeCustomizeThemeView = Pick<
  ResolvedThemeDefinition,
  | "key"
  | "chain"
  | "contract"
  | "manifest"
  | "options"
  | "fonts"
  | "fontChoices"
  | "palette"
  | "colorPalettes"
  | "templateVariants"
  | "responsive"
  | "layoutDecl"
>;
export type ThemeCustomizeChoice = { key: string; name: string; contract: 7 | 8; chain: readonly string[]; palettes: { id: string; name: string }[] };
export type ThemeCustomizeData = {
  // Documento em edição: o rascunho, ou (sem rascunho) uma cópia da config publicada.
  document: ThemeConfigDocument;
  draft: ThemeConfigRevisionView | null;
  storageUnavailable: boolean;
  themes: ThemeCustomizeChoice[];
  theme: ThemeCustomizeThemeView;
};

function toThemeView(theme: ResolvedThemeDefinition): ThemeCustomizeThemeView {
  const { key, chain, contract, manifest, options, fonts, fontChoices, palette, colorPalettes, templateVariants, responsive, layoutDecl } = theme;
  // JSON (não structuredClone): descarta qualquer valor não serializável que um manifesto traga.
  return JSON.parse(JSON.stringify({ key, chain, contract, manifest, options, fonts, fontChoices, palette, colorPalettes, templateVariants, responsive, layoutDecl }));
}

export async function loadThemeCustomizeData(): Promise<OperationResult<ThemeCustomizeData>> {
  const [draft, published, isEnabled] = await Promise.all([getThemeDraft(), getPublishedThemeConfig(), loadThemeEnabledCheck()]);
  if (!draft.success && draft.error.code !== THEME_CONFIG_STORAGE_UNAVAILABLE) return draft;

  let document: ThemeConfigDocument;
  if (draft.success && draft.data) {
    document = draft.data.config;
  } else if (published.success) {
    const { revisionId, publishedAt, source, ...rest } = published.data;
    void revisionId;
    void publishedAt;
    void source;
    document = rest;
  } else {
    document = defaultThemeConfigDocument();
  }

  const themes: ThemeCustomizeChoice[] = Object.values(THEME_REGISTRY)
    .filter((entry) => isEnabled(entry.manifest.key))
    .map((entry) => ({
      key: entry.manifest.key,
      name: entry.manifest.name,
      contract: entry.contract,
      chain: entry.contract === 8 ? entry.lineage : [entry.manifest.key],
      palettes: entry.colorPalettes.map((palette) => ({ id: palette.id, name: palette.name })),
    }));

  return {
    success: true,
    data: {
      document,
      draft: draft.success ? draft.data : null,
      storageUnavailable: !draft.success,
      themes,
      theme: toThemeView(resolveThemeDefinition(document.themeKey, { isEnabled }).theme),
    },
  };
}

export type ThemeConfigHistoryEntryView = ThemeConfigRevisionView & { authorName: string | null; themeName: string };
export type ThemeConfigHistoryView = { items: ThemeConfigHistoryEntryView[]; storageUnavailable: boolean };

// Histórico (spec §7.2: últimas 20 publicações, com autor e data) com o nome de quem publicou e o
// nome do tema resolvidos para a tela.
export async function loadThemeConfigHistory(): Promise<OperationResult<ThemeConfigHistoryView>> {
  const history = await listThemeConfigHistory();
  if (!history.success) {
    if (history.error.code === THEME_CONFIG_STORAGE_UNAVAILABLE) return { success: true, data: { items: [], storageUnavailable: true } };
    return history;
  }
  const users = await listUsers();
  const names = new Map(users.success ? users.data.map((user) => [user.id, user.name ?? user.email]) : []);
  return {
    success: true,
    data: {
      storageUnavailable: false,
      items: history.data.items.map((item) => {
        const authorId = item.publishedBy ?? item.createdBy;
        return {
          ...item,
          authorName: authorId ? (names.get(authorId) ?? null) : null,
          themeName: THEME_REGISTRY[item.config.themeKey]?.manifest.name ?? item.config.themeKey,
        };
      }),
    },
  };
}

export type ThemeDraftStatus = { draft: ThemeConfigRevisionView | null; storageUnavailable: boolean };

export async function loadThemeDraftStatus(): Promise<OperationResult<ThemeDraftStatus>> {
  const draft = await getThemeDraft();
  if (!draft.success) {
    if (draft.error.code === THEME_CONFIG_STORAGE_UNAVAILABLE) return { success: true, data: { draft: null, storageUnavailable: true } };
    return draft;
  }
  return { success: true, data: { draft: draft.data, storageUnavailable: false } };
}
