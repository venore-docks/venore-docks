import type { AdminNavItemDefinition } from "@/platform/admin-shell/admin-navigation.contracts";

// Painel da leitura em voz alta (/admin/speech): fila, andamento de cada conteúdo, worker e
// configuração (voz, teto, ligar/desligar). Fica no Editorial, perto do conteúdo que gera áudio,
// mas exige settings.manage (o painel muda a configuração do site).
export const speechAdminNavigationItems: AdminNavItemDefinition[] = [
  {
    key: "speech.overview",
    label: "Áudios",
    icon: "headphones",
    href: "/admin/speech",
    groupKey: "content",
    groupLabel: "Editorial",
    groupOrder: 20,
    order: 70,
    requiredPermission: "settings.manage",
  },
];
