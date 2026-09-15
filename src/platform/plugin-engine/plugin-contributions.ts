import type { ReactNode } from "react";
import type { BlockDefinition } from "@/contexts/cms";
import type { NavItem } from "@/contexts/themes";
import type { OperationResult } from "@/shared/types";
import type { BreadcrumbSegmentDefinition } from "@/platform/breadcrumbs/types";
import type { MediaUsageProvider } from "@/platform/media-usage/types";
import type { NotificationAlert } from "@/platform/notifications/types";
import type { BlockRendererComponent } from "@/platform/page-builder/block-renderers";

// Uma função de seed é idempotente por contrato (list-then-skip pelo próprio seed) e devolve o
// OperationResult<void> padrão — nunca lança para erro esperado.
export type PluginSeedFn = () => Promise<OperationResult<void>>;

// O que um plugin contribui pro CORE além de metadado de manifesto (navegação, permissions,
// settings — esses continuam no manifest.ts, dado puro validado por zod). Aqui vai o CÓDIGO:
// segmentos de breadcrumb, resolver de alerta, resolver de uso de mídia, item de user-nav, seeds,
// definições de bloco do page-builder. Um plugin declara isso num `contributions.ts` na raiz da
// pasta dele (tipado com este `PluginContributions`); o codegen (scripts/gen-plugin-registry.ts)
// agrega os presentes em src/plugins/contributions.generated.ts, e os registries de platform/
// iteram esse mapa em vez de `import "@/plugins/<x>"`. Ver docs/plugins-repos-separados-plano.md.
//
// `blockDefinitions` é dado puro serializável (vem de blocks/definitions.ts, sem tocar em
// handler/auth) — entra direto. `blockRenderers` puxa a árvore de componentes de render (que sobe
// até @/contexts/auth -> next-auth), então é um LOADER preguiçoso: só block-renderers.tsx (que é
// "server-only") o chama, e o `import()` mantém essa cadeia fora do grafo de quem só quer
// breadcrumbs/seeds/mídia. `blockFieldPanels` NÃO mora aqui: é alcançável do builder client
// (composition-builder.tsx, "use client"), então vive em `contributions.client.ts` +
// PluginClientContributions, agregado num .generated à parte que nunca passa por este módulo.
export type PluginContributions = {
  breadcrumbSegments?: BreadcrumbSegmentDefinition[];
  notificationAlert?: () => Promise<NotificationAlert>;
  mediaUsageResolver?: MediaUsageProvider;
  userNavItems?: () => Promise<NavItem[]>;
  seeds?: Record<string, PluginSeedFn>;
  blockDefinitions?: BlockDefinition[];
  blockRenderers?: () => Promise<Record<string, BlockRendererComponent>>;
  // Blocos de conteúdo que um plugin injeta em páginas do core (não são rotas). Cada um é um
  // thunk preguiçoso que faz o PRÓPRIO gate/fetch e devolve o JSX pronto, ou `null` quando não
  // tem o que mostrar (sem acesso, sem dado, plugin sem esse painel). A página do core itera os
  // plugins ativos e usa o primeiro não-nulo.
  // - adminDashboardPanel: painel principal de /admin (hoje o resumo da Academy).
  // - publicHomeShowcase: vitrine no meio da home "/" quando não há entry "home" no CMS.
  adminDashboardPanel?: () => Promise<ReactNode>;
  publicHomeShowcase?: () => Promise<ReactNode>;
};
