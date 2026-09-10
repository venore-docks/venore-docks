import type { PermissionDefinition } from "@/contexts/rbac";
import type { PluginRegistrationEntry } from "@/platform/plugin-engine/types";

// Camada só de apresentação sobre RBAC_PERMISSIONS (docs/venore-docks.md — Modelo de RBAC):
// nenhuma chave, permissão ou regra do motor é criada/alterada aqui, só o texto e o agrupamento
// mostrados na tela /admin/rbac. Permissões de plugin (ex: academy.courses.manage) não têm essa
// curadoria manual — usam o `label` do próprio manifesto como título e descrição, e são agrupadas
// pelo nome do plugin que as declarou.
export type PermissionView = { key: string; title: string; description: string };
export type PermissionGroupView = { id: string; label: string; permissions: PermissionView[] };

const GROUP_ORDER: { id: string; label: string }[] = [
  { id: "people-and-access", label: "Pessoas e acessos" },
  { id: "content", label: "Editorial" },
  { id: "media", label: "Arquivos e mídia" },
  { id: "settings", label: "Configurações da organização" },
  { id: "system", label: "Sistema e extensões" },
];

const CORE_PERMISSION_COPY: Record<string, { groupId: string; title: string; description: string }> = {
  "rbac.roles.manage": {
    groupId: "people-and-access",
    title: "Criar e editar papéis",
    description: "Permite criar novos papéis e decidir o que cada um pode fazer.",
  },
  "rbac.roles.assign": {
    groupId: "people-and-access",
    title: "Atribuir papéis às pessoas",
    description: "Permite escolher qual papel cada pessoa da equipe tem.",
  },
  "rbac.registrations.approve": {
    groupId: "people-and-access",
    title: "Aprovar cadastros",
    description: "Permite aceitar ou recusar pedidos de pessoas querendo entrar na organização.",
  },
  "cms.entries.manage": {
    groupId: "content",
    title: "Criar e publicar conteúdo",
    description: "Permite criar, editar e publicar textos, páginas e outros conteúdos do site.",
  },
  "cms.content-types.manage": {
    groupId: "content",
    title: "Definir tags",
    description: 'Permite criar novas tags de conteúdo, como "Evento" além de "Notícia".',
  },
  "cms.categories.manage": {
    groupId: "content",
    title: "Organizar categorias",
    description: "Permite criar e reorganizar as categorias usadas para classificar o conteúdo.",
  },
  "cms.menus.manage": {
    groupId: "content",
    title: "Editar menus do site",
    description: "Permite mudar os menus de navegação que aparecem para quem visita o site.",
  },
  "media.manage": {
    groupId: "media",
    title: "Enviar e organizar arquivos",
    description: "Permite enviar, renomear e organizar imagens e arquivos na biblioteca de mídia.",
  },
  "media.purge": {
    groupId: "media",
    title: "Excluir arquivos definitivamente",
    description: "Permite apagar arquivos de mídia sem possibilidade de recuperação depois.",
  },
  "settings.manage": {
    groupId: "settings",
    title: "Alterar configurações gerais",
    description: "Permite mudar as configurações gerais da organização, como nome e preferências.",
  },
  "platform.admin.access": {
    groupId: "system",
    title: "Acessar o painel administrativo",
    description: "Permite entrar nas telas de administração do sistema.",
  },
  "platform.extensions.manage": {
    groupId: "system",
    title: "Instalar e gerenciar extensões",
    description: "Permite ativar, desativar e configurar extensões (plugins) instaladas na plataforma.",
  },
  "observability.logs.view": {
    groupId: "system",
    title: "Ver histórico de atividades do sistema",
    description: "Permite consultar os registros técnicos de eventos e erros do sistema.",
  },
  "content-feed.connections.manage": {
    groupId: "content",
    title: "Gerenciar quem assina o feed de conteúdo",
    description: "Permite criar chaves de conexão e escolher quais categorias outras instâncias podem receber daqui.",
  },
  "content-feed.sources.manage": {
    groupId: "content",
    title: "Gerenciar de onde este site assina conteúdo",
    description: "Permite cadastrar outras instâncias como fonte de conteúdo e sincronizar o que elas publicam.",
  },
};

export function buildPermissionGroups(
  permissions: PermissionDefinition[],
  pluginEntries: PluginRegistrationEntry[] = [],
): PermissionGroupView[] {
  const groups = new Map<string, PermissionGroupView>(
    GROUP_ORDER.map((group) => [group.id, { id: group.id, label: group.label, permissions: [] }]),
  );

  for (const permission of permissions) {
    const core = CORE_PERMISSION_COPY[permission.key];
    if (core) {
      groups.get(core.groupId)?.permissions.push({
        key: permission.key,
        title: core.title,
        description: core.description,
      });
      continue;
    }

    const owningPlugin = pluginEntries.find(
      (entry) => entry.manifest && permission.key.startsWith(`${entry.manifest.key}.`),
    );
    const groupId = owningPlugin ? `plugin:${owningPlugin.key}` : "other";
    const groupLabel = owningPlugin ? owningPlugin.manifest!.name : "Outras permissões";

    if (!groups.has(groupId)) {
      groups.set(groupId, { id: groupId, label: groupLabel, permissions: [] });
    }
    groups.get(groupId)?.permissions.push({
      key: permission.key,
      title: permission.label,
      description: permission.label,
    });
  }

  return Array.from(groups.values()).filter((group) => group.permissions.length > 0);
}
