import type { AdminNavItemDefinition } from "@/platform/admin-shell/admin-navigation.contracts";

export const rbacAdminNavigationItems: AdminNavItemDefinition[] = [
  {
    key: "rbac.community",
    label: "Comunidade",
    icon: "users",
    href: "/admin/community",
    groupKey: "platform",
    groupLabel: "Plataforma",
    groupOrder: 10,
    order: 55,
    // OR: quem só aprova/rejeita cadastro (sem rbac.users.manage) também precisa ver a seção pra
    // chegar na fila de pendentes.
    requiredPermission: ["rbac.users.manage", "rbac.registrations.approve"],
  },
  {
    key: "rbac.roles",
    label: "Papéis e permissões",
    icon: "shield-check",
    href: "/admin/rbac",
    groupKey: "platform",
    groupLabel: "Plataforma",
    groupOrder: 10,
    order: 60,
    requiredPermission: "rbac.roles.manage",
  },
];
