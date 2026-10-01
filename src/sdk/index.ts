// @venore/plugin-sdk — raiz da superfície SERVER / domínio que um plugin pode usar.
//
// A superfície de cada context vem por SUBPATH próprio (espelha a estrutura de hoje, evita
// colisão de nomes entre contexts): `@venore/plugin-sdk/rbac`, `/auth`, `/cms`, `/media`,
// `/settings`, `/import-export`, `/web-push`, `/observability`. Client React em
// `@venore/plugin-sdk/ui`. (Helpers de seed de integração — `/testing` — voltam quando o primeiro
// plugin for reconstruído; cada plugin traz os seus.)
//
// Plano: docs/plugins-repos-separados-plano.md. Enquanto os plugins estão no monorepo, é só um
// alias de tsconfig; na extração (Fase 3) vira pacote publicado, com bundle reescrevendo os `@/…`.
//
// NÃO importar deste entrypoint (nem dos subpaths de context) em componente CLIENT de plugin —
// arrasta `pg`/server-only pro bundle do browser. Client usa "@venore/plugin-sdk/ui".

// --- shared / infra ---
export type { OperationResult } from "@/shared/types";
export { db } from "@/infrastructure/database/client";
export { getCache, setCache, invalidateCache, invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";

// --- plugin engine / routing ---
export { isPluginActive } from "@/platform/plugin-engine/is-plugin-active";
export { importActivePluginBarrel } from "@/platform/plugin-engine/import-plugin-barrel";
export type { PluginManifest } from "@/platform/plugin-engine/manifest-schema";
export type { PluginContributions, PluginSeedFn, PluginOutletContribution } from "@/platform/plugin-engine/plugin-contributions";
// Outlets do tema v8 (spec §2.8) — o plugin declara em PluginContributions.outlets.
export { THEME_OUTLET_NAMES } from "@/contexts/themes/contracts/v8/outlets";
export type { ThemeOutletName, OutletRenderContext } from "@/contexts/themes/contracts/v8/outlets";
export * from "@/platform/plugin-routing/types";
// NÃO reexportar @/platform/plugin-engine/plugin-seed-registry: ele importa @/plugins/contributions
// (pra RESOLVER seeds), e um plugin que importa deste entry fecharia ciclo em runtime via o
// próprio contributions.ts. Um plugin DECLARA `seeds` no contributions.ts; nunca resolve.

// --- platform helpers LEVES usados por plugin ---
// Só o que é folha (ou quase). O ENTRY RAIZ tem que ser barato de importar: um plugin importa
// "@venore/plugin-sdk" só pra `OperationResult` ou `db` e não pode pagar o grafo de auth/rbac/
// themes/media/cms com isso. As superfícies PESADAS foram pra subpaths:
//   - getPluginAdminPageData / AdminPageGate  -> "@venore/plugin-sdk/admin"  (puxa auth+rbac)
//   - getBrandConfig / resolveBrandAesthetics -> "@venore/plugin-sdk/brand"  (puxa themes+media+settings)
//   - renderRichTextContent / hasRichTextContent / RICH_TEXT_INLINE_CLASSES + <BlockRenderer>
//        -> "@venore/plugin-sdk/page-builder"  (puxa cms + tiptap + block-registry)
//   - deleteMediaSafely -> "@venore/plugin-sdk/media"  (puxa media-usage-registry -> ciclo)
export * from "@/platform/breadcrumbs/types";
export * from "@/platform/breadcrumbs/define-segment";
export * from "@/platform/media-usage/types";
export type {
  BlockRendererComponent,
  BlockRendererProps,
  BlockRenderMode,
} from "@/platform/page-builder/block-renderers";
// NÃO reexportar aqui o componente <BlockRenderer> (@/components/page-builder/block-renderer):
// ele puxa block-registry -> @/plugins/contributions e fecha ciclo em runtime com o
// contributions.ts de qualquer plugin que importe deste entry.
