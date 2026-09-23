import semver from "semver";
import { z } from "zod";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const pluginDependencySchema = z.object({
  pluginKey: z.string().min(1),
  type: z.enum(["required", "optional"]),
});

const pluginCompatibilitySchema = z.object({
  coreVersion: z.string().refine((range) => semver.validRange(range) !== null, {
    message: 'coreVersion precisa ser uma faixa semver válida (ex: ">=2.0.0 <3.0.0").',
  }),
});

const pluginPermissionSchema = z.object({ key: z.string().min(1), label: z.string().min(1) });
const pluginSettingSchema = z.object({ key: z.string().min(1), defaultValue: z.unknown() });
const pluginNavigationSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  href: z.string().min(1),
  // Campos que espelham AdminNavItemDefinition (platform/admin-shell/admin-navigation.contracts.ts)
  // — permitem que a navegação admin agregue o item de um plugin igual agrega o de um context,
  // sem lista central enumerando telas à mão (docs/venore-docks.md — "Sistema de plugins").
  icon: z.string().min(1),
  groupKey: z.string().min(1),
  groupLabel: z.string().min(1),
  groupOrder: z.number(),
  order: z.number(),
  requiredPermission: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
});
const pluginRouteSchema = z.object({ path: z.string().min(1), label: z.string().min(1) });
const pluginContentTypeSchema = z.object({ key: z.string().min(1), label: z.string().min(1) });
const pluginBlockSchema = z.object({ key: z.string().min(1), label: z.string().min(1) });
// Seed de dados de exemplo do plugin (docs/venore-docks.md — "Sistema de plugins"). Cada `key`
// mapeia para uma função registrada em platform/plugin-engine/plugin-seed-registry.ts; `label`/
// `description` são o texto mostrado no diálogo de instalação e no botão "Popular dados de
// exemplo" de /admin/plugins. Seed key é local ao plugin — sem regra de namespace global (ao
// contrário de permissions).
const pluginSeedSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

// Espelha o PluginManifest de docs/venore-docks.md — "Sistema de plugins" / "Contrato de
// manifesto", campo a campo.
export const pluginManifestSchema = z
  .object({
    manifestVersion: z.string().min(1),
    key: z.string().regex(KEBAB_CASE, "key precisa ser kebab-case."),
    name: z.string().min(1),
    version: z.string().refine((value) => semver.valid(value) !== null, {
      message: "version precisa ser um semver válido.",
    }),
    description: z.string().optional(),
    dependencies: z.array(pluginDependencySchema).optional(),
    compatibility: pluginCompatibilitySchema.optional(),
    permissions: z.array(pluginPermissionSchema).optional(),
    settings: z.array(pluginSettingSchema).optional(),
    navigation: z.array(pluginNavigationSchema).optional(),
    routes: z.array(pluginRouteSchema).optional(),
    contentTypes: z.array(pluginContentTypeSchema).optional(),
    blocks: z.array(pluginBlockSchema).optional(),
    seeds: z.array(pluginSeedSchema).optional(),
    // Onde ficam as migrations próprias do plugin (docs/venore-docks.md — "Schema e migrations").
    // Ausente == plugin sem schema próprio (settings-only, ex: donations) — instalar não roda
    // nenhuma migration. Presente == platform/plugin-engine/run-plugin-migrations.ts aplica essa
    // árvore no install (nunca no vercel-build).
    // - migrationsPath: relativo à pasta do plugin (ex: "./migrations").
    // - migrationsSchema: schema Postgres da tabela de tracking. Default derivado da key com
    //   "-" trocado por "_" e sufixo "_migrations" (ex: "enrollment-dashboard" ->
    //   "enrollment_dashboard_migrations") — é o mesmo valor que o drizzle.config.ts de cada
    //   plugin já declara, pra core e plugin não competirem pelo mesmo cursor de migration.
    // - migrationsTable: default "__drizzle_migrations".
    migrationsPath: z.string().min(1).optional(),
    migrationsSchema: z.string().min(1).optional(),
    migrationsTable: z.string().min(1).optional(),
    // Categorias reservadas (media.uploadReservedCategoryAsset*) do PRÓPRIO plugin que aceitam
    // upload SEM sessão (uploadReservedCategoryAssetPublic — platform/media-lifecycle/upload-
    // reserved-category-asset-public-gated.ts). Upload anônimo é uma capacidade sensível (não
    // existia na plataforma até este campo — todo upload exigia login); sem estar listada aqui,
    // uma categoria nunca aceita envio anônimo, mesmo que o código do plugin peça. Declarativo de
    // propósito, mesmo racional de `permissions`: auditável no manifesto, nunca decidido em
    // runtime por string solta vinda de quem chama.
    anonymousUploadCategories: z.array(z.string().min(1)).optional(),
  })
  .superRefine((manifest, ctx) => {
    // Namespace de permission (docs/venore-docks.md — "Modelo de RBAC": "<plugin>.<recurso>.<acao>")
    // impede que um plugin declare uma permission colidindo com o catálogo do core ou de outro plugin.
    for (const permission of manifest.permissions ?? []) {
      if (!permission.key.startsWith(`${manifest.key}.`)) {
        ctx.addIssue({
          code: "custom",
          path: ["permissions"],
          message: `Permission "${permission.key}" precisa começar com o namespace "${manifest.key}.".`,
        });
      }
    }
  });

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
