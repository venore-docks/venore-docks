import type { PermissionDefinition } from "./types";

export const RBAC_PERMISSIONS: PermissionDefinition[] = [
  { key: "rbac.roles.manage", label: "Gerenciar papéis e permissions" },
  { key: "rbac.roles.assign", label: "Atribuir papéis a usuários" },
  { key: "rbac.registrations.approve", label: "Aprovar registros pendentes" },
  // Pertence conceitualmente a contexts/settings — mora aqui porque ainda não existe agregação
  // de permissions entre contexts (docs/venore-docks.md — Modelo de RBAC).
  { key: "settings.manage", label: "Alterar configurações do site" },
  // Pertence conceitualmente a contexts/cms — mesmo stopgap de settings.manage acima.
  { key: "cms.content-types.manage", label: "Gerenciar content types do CMS" },
  { key: "cms.categories.manage", label: "Gerenciar categorias do CMS" },
  { key: "cms.entries.manage", label: "Gerenciar entries do CMS" },
  // Fase 4/P3 (docs/implementation-roadmap.md) — permission estreita, separada de
  // cms.entries.manage: cobre só publish-entry/schedule-entry. Um "Autor" (cms.entries.manage
  // sem esta) pode criar/editar mas nunca fazer um rascunho ir ao ar sozinho. Quem já tem
  // cms.entries.manage continua publicando normalmente (authorizeActor aceita as duas — ver
  // publish-entry/schedule-entry handlers), então papéis existentes (admin/superadmin) não
  // perdem nada.
  { key: "cms.entries.publish", label: "Publicar/agendar entries do CMS" },
  { key: "cms.menus.manage", label: "Gerenciar menus do CMS" },
  // Pertence conceitualmente ao admin shell (platform/), não a um único context de domínio —
  // mesmo stopgap das entradas acima, até existir agregação de permissions entre contexts.
  { key: "platform.admin.access", label: "Acessar área administrativa" },
  // Habilitar/desabilitar plugin ou tema (contexts/extensions) — ação distinta de
  // platform.admin.access (que só permite ver a tela de diagnóstico dos plugins).
  { key: "platform.extensions.manage", label: "Habilitar ou desabilitar plugins e temas" },
  // Pertence conceitualmente a contexts/media — mesmo stopgap de settings.manage acima.
  { key: "media.manage", label: "Gerenciar arquivos de mídia" },
  // Restrita a superadmin (docs/media/blob-spec.md seção 6) — diferente de media.manage (soft
  // delete reversível), esta cobre o hard delete que perde o blob de verdade.
  { key: "media.purge", label: "Apagar mídia definitivamente" },
  // Pertence conceitualmente a observability/ (infraestrutura técnica, não um context de
  // domínio) — mesmo stopgap das entradas acima.
  { key: "observability.logs.view", label: "Ver logs de observabilidade" },
  // Ação privilegiada e destrutiva (expurgo manual do log operacional) — separada de
  // observability.logs.view de propósito, mesmo padrão de media.purge vs media.manage.
  { key: "observability.logs.clear", label: "Limpar logs operacionais de diagnóstico" },
  // Trilha de auditoria de segurança é mais sensível que o log operacional (não é apagável por
  // ninguém via UI) — permission própria, não reaproveita observability.logs.view.
  { key: "observability.audit.view", label: "Ver auditoria de segurança" },
  // Pertence conceitualmente a contexts/content-feed — mesmo stopgap de settings.manage acima.
  // Lado publicador: quem pode criar/apagar conexão e escolher categorias liberadas pra ela.
  { key: "content-feed.connections.manage", label: "Gerenciar quem pode assinar o feed de conteúdo" },
  // Lado assinante: quem pode cadastrar/apagar fonte remota e disparar sincronização manual.
  { key: "content-feed.sources.manage", label: "Gerenciar de onde este site assina conteúdo" },
];
