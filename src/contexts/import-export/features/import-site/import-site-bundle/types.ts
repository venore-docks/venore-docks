import { z } from "zod";
import type { ResolveBlockDefinition } from "@/contexts/cms";
import type { OperationResult } from "@/shared/types";
import { IMPORT_EXPORT_FORMAT, IMPORT_EXPORT_FORMAT_VERSION, type ImportReport } from "../../../contracts/types";

const mediaVisibilitySchema = z.enum(["public", "restricted", "private"]);
const entryStatusSchema = z.enum(["draft", "scheduled", "published", "archived"]);
const entryVisibilitySchema = z.enum(["public", "authenticated"]);
const menuLocationSchema = z.enum(["main", "header", "contextual", "sitemap"]);
const menuItemTargetTypeSchema = z.enum(["content", "route", "external", "label"]);

const exportedMediaCategorySchema = z.object({ name: z.string().min(1) });

const exportedMediaAssetSchema = z.object({
  ref: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().nonnegative(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  alt: z.string().nullable(),
  checksum: z.string().min(1),
  visibility: mediaVisibilitySchema,
  categoryName: z.string().nullable(),
  file: z.string().min(1),
});

const exportedContentTypeSchema = z.object({ key: z.string().min(1), name: z.string().min(1), description: z.string().nullable() });

const exportedCategorySchema = z.object({
  key: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
});

const exportedEntrySchema = z.object({
  ref: z.string().min(1),
  categoryKey: z.string().nullable(),
  tagKeys: z.array(z.string()),
  title: z.string().min(1),
  slug: z.string().min(1),
  status: entryStatusSchema,
  scheduledPublishAt: z.string().nullable(),
  scheduledArchiveAt: z.string().nullable(),
  visibility: entryVisibilitySchema,
  data: z.unknown(),
  mediaRef: z.string().nullable(),
  authorEmail: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

const exportedMenuItemSchema = z.object({
  exportId: z.string().min(1),
  parentExportId: z.string().nullable(),
  label: z.string().min(1),
  order: z.number(),
  isVisible: z.boolean(),
  icon: z.string().nullable(),
  targetType: menuItemTargetTypeSchema,
  contentRef: z.string().nullable(),
  // .default(null): bundles exportados antes deste campo existir não têm a chave — sem default a
  // importação de um pacote antigo falharia na validação por uma chave ausente e irrelevante.
  anchor: z.string().nullable().default(null),
  routePath: z.string().nullable(),
  requiredPermissionKey: z.string().nullable(),
  externalUrl: z.string().nullable(),
  // .default(false): mesmo raciocínio de `anchor` acima — bundle exportado antes deste campo
  // existir não tem a chave, sem default a importação de um pacote antigo falharia à toa.
  openInNewTab: z.boolean().default(false),
});

const exportedMenuSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  location: menuLocationSchema,
  scopePath: z.string().nullable(),
  items: z.array(exportedMenuItemSchema),
});

// Validação de fronteira do pacote não confiável (zip enviado pelo admin) antes de qualquer
// gravação — mesmo raciocínio de validar input em handler.ts, só que aqui o "input" é um arquivo
// inteiro, não um form field.
export const exportManifestSchema = z.object({
  format: z.literal(IMPORT_EXPORT_FORMAT),
  formatVersion: z.literal(IMPORT_EXPORT_FORMAT_VERSION),
  exportedAt: z.string(),
  mediaCategories: z.array(exportedMediaCategorySchema),
  mediaAssets: z.array(exportedMediaAssetSchema),
  contentTypes: z.array(exportedContentTypeSchema),
  categories: z.array(exportedCategorySchema),
  entries: z.array(exportedEntrySchema),
  menus: z.array(exportedMenuSchema),
});

// resolveDefinition entra por injeção (nunca importado direto de platform/page-builder — um
// context não pode depender de platform/, mesma direção de dependência do resto do projeto):
// quem chama de dentro de app/ já resolve isso pra publish-entry normal (ver
// app/(platform)/admin/cms/entries/[id]/actions.ts), a rota de import repete o mesmo wiring.
export type ImportSiteBundleCommand = {
  manifest: unknown;
  files: Map<string, Buffer>;
  actorId: string;
  resolveDefinition: ResolveBlockDefinition;
};
export type ImportSiteBundleInput = Omit<ImportSiteBundleCommand, "actorId">;
export type ImportSiteBundleResult = OperationResult<ImportReport>;
