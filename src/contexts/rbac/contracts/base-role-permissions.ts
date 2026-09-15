// Permissions base concedidas ao papel de sistema "admin" numa instalação nova — FONTE ÚNICA.
//
// Consumida pelo self-heal em código (src/contexts/rbac/ensure-base-rbac-data.ts). A migration
// drizzle/0027_seed_base_role_permissions.sql tem a mesma lista embutida em SQL (não dá pra
// importar TS de um .sql), mas já rodou onde rodou e NÃO deve ser alterada — daqui pra frente o
// self-heal é a fonte da verdade. Só adicionar migration nova se algum ambiente puder estar sem
// essas linhas.
//
// Lista explícita, NÃO derivada de RBAC_PERMISSIONS de propósito (mesmo racional do comentário em
// 0027): uma permission nova só alcança "admin" por decisão explícita registrada aqui, nunca
// automaticamente por já estar no catálogo. "media.purge" fica de fora — reservada a superadmin,
// que não passa por role_permissions (authorize-actor.ts libera incondicional).
export const ADMIN_BASE_PERMISSION_KEYS = [
  "rbac.roles.manage",
  "rbac.roles.assign",
  "rbac.registrations.approve",
  "rbac.users.manage",
  "settings.manage",
  "cms.content-types.manage",
  "cms.categories.manage",
  "cms.entries.manage",
  "cms.entries.publish",
  "cms.menus.manage",
  "platform.admin.access",
  "platform.extensions.manage",
  "media.manage",
  "observability.logs.view",
  "observability.logs.clear",
  "observability.audit.view",
] as const;

// Permissions base dos papéis de sistema "editor" e "author" numa instalação nova (Fase A de
// docs/rbac-scoped-roles.md — D9). Mesma natureza de ADMIN_BASE_PERMISSION_KEYS: lista explícita,
// aplicada idempotentemente pelo self-heal em ensure-base-rbac-data.ts. Na Fase A esses papéis
// nascem GLOBAIS no CMS — o recorte por categoria (role_assignment_scopes) é a Fase C.
//
// editor: modera setores editoriais — gerencia categorias atribuídas, gerencia e publica entries.
// author: cria/edita entries (só rascunho) — NÃO recebe cms.entries.publish nem
// cms.categories.manage (ver tabela da D6).
export const EDITOR_BASE_PERMISSION_KEYS = [
  "platform.admin.access",
  "cms.categories.manage",
  "cms.entries.manage",
  "cms.entries.publish",
] as const;

export const AUTHOR_BASE_PERMISSION_KEYS = [
  "platform.admin.access",
  "cms.entries.manage",
] as const;
