import type { AdminNavItemDefinition } from "@/platform/admin-shell/admin-navigation.contracts";

export const contentFeedAdminNavigationItems: AdminNavItemDefinition[] = [
  {
    key: "content-feed.overview",
    label: "Feed de conteúdo",
    icon: "newspaper",
    href: "/admin/content-feed",
    groupKey: "content",
    groupLabel: "Editorial",
    groupOrder: 20,
    order: 60,
    requiredPermission: ["content-feed.connections.manage", "content-feed.sources.manage"],
  },
];
