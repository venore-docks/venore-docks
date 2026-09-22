import type { EntryStatus, EntryVisibility, MenuItemTarget, MenuLocation } from "@/contexts/cms";
import type { MediaVisibility } from "@/contexts/media";

// Formato do pacote de import/export (IE1 — docs/implementation-roadmap.md, Fase 8). Versão de
// formato própria, independente de VERSION do projeto (docs/venore-docks.md) — só muda quando o
// SHAPE do manifest muda de um jeito que quebra leitura por uma versão anterior do importador.
export const IMPORT_EXPORT_FORMAT = "venore-import-export";
export const IMPORT_EXPORT_FORMAT_VERSION = 1;

// Toda referência cruzada dentro do manifest é por slug/key/checksum, nunca por id de banco — id
// não sobrevive a uma migração pra outro banco (é o motivo de existir este pacote). "ref" abaixo
// sempre nomeia esse tipo de referência estável.
export type ExportedMediaCategory = { name: string };

export type ExportedMediaAsset = {
  // Checksum sha256 do conteúdo (infrastructure/storage/checksum.ts) — endereçável por conteúdo,
  // dois exports/imports do mesmo arquivo colidem no mesmo ref sem depender de id nem nome.
  ref: string;
  filename: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  checksum: string;
  visibility: MediaVisibility;
  categoryName: string | null;
  // Caminho do arquivo dentro do zip (assets/<checksum>-<filename sanitizado>).
  file: string;
};

export type ExportedContentType = { key: string; name: string; description: string | null };

export type ExportedCategory = { key: string; slug: string; name: string; description: string | null };

export type ExportedEntry = {
  // categoryKey/slug (ou só slug quando não tem categoria) — mesma regra de unicidade do banco
  // (entries_category_slug_idx / entries_null_category_slug_idx).
  ref: string;
  categoryKey: string | null;
  tagKeys: string[];
  title: string;
  slug: string;
  status: EntryStatus;
  scheduledPublishAt: string | null;
  scheduledArchiveAt: string | null;
  visibility: EntryVisibility;
  // data.blocks (composição) tem todo mediaId reescrito pro checksum do asset referenciado —
  // ver composition-media-refs.ts. Campos livres (ex: data.body) passam intactos.
  data: unknown;
  mediaRef: string | null;
  authorEmail: string | null;
  publishedAt: string | null;
};

export type ExportedMenuItem = {
  // Id sintético, único só dentro deste arquivo — existe pra representar o parentId de outro
  // item do mesmo menu no export, nunca é (nem vira) id de banco.
  exportId: string;
  parentExportId: string | null;
  label: string;
  order: number;
  isVisible: boolean;
  icon: string | null;
  targetType: MenuItemTarget["targetType"];
  contentRef: string | null;
  anchor: string | null;
  routePath: string | null;
  requiredPermissionKey: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
};

export type ExportedMenu = {
  key: string;
  name: string;
  location: MenuLocation;
  scopePath: string | null;
  items: ExportedMenuItem[];
};

export type ExportManifest = {
  format: typeof IMPORT_EXPORT_FORMAT;
  formatVersion: typeof IMPORT_EXPORT_FORMAT_VERSION;
  exportedAt: string;
  mediaCategories: ExportedMediaCategory[];
  mediaAssets: ExportedMediaAsset[];
  contentTypes: ExportedContentType[];
  categories: ExportedCategory[];
  entries: ExportedEntry[];
  menus: ExportedMenu[];
};

export type ImportReportLineKind = "media-category" | "media-asset" | "content-type" | "category" | "entry" | "menu" | "menu-item";
export type ImportReportOutcome = "created" | "reused" | "skipped" | "failed";

export type ImportReportLine = {
  kind: ImportReportLineKind;
  ref: string;
  outcome: ImportReportOutcome;
  message?: string;
};

export type ImportReport = {
  lines: ImportReportLine[];
  createdCount: number;
  reusedCount: number;
  skippedCount: number;
  failedCount: number;
};

// Permissions exigidas pra rodar export/import do pacote inteiro (CMS + mídia) — todas ao mesmo
// tempo (AND), não "qualquer uma" (o OR de authorizeActor não serve aqui: exportar/importar
// menu sem cms.menus.manage vazaria/gravaria dado que o ator não tem permission pra ver/escrever
// por conta própria). Cada chamada downstream (createEntry, uploadMediaAsset etc.) ainda faz a
// própria checagem — esta lista é só o gate de entrada do pacote inteiro.
export const IMPORT_EXPORT_REQUIRED_PERMISSIONS = [
  "cms.content-types.manage",
  "cms.categories.manage",
  "cms.entries.manage",
  "cms.menus.manage",
  "media.manage",
] as const;
