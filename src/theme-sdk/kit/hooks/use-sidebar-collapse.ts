"use client";

import { useTransition } from "react";
import { setSidebarCollapsed, useSidebarCollapsed } from "../stores/sidebar-collapse-store";

// Colapso da rail (spec v8 §7.8): store otimista (a largura muda no clique) + Server Action que só
// persiste o cookie, rodando por baixo via startTransition. O botão do header (arranjo "rail") e a
// própria rail leem/escrevem o MESMO store — nunca dois `useState` dessincronizados.
export function useSidebarCollapse(collapsedFromServer: boolean, onToggleCollapsed: () => Promise<void>) {
  const collapsed = useSidebarCollapsed(collapsedFromServer);
  const [, startTransition] = useTransition();

  function toggle() {
    setSidebarCollapsed(!collapsed);
    startTransition(() => {
      onToggleCollapsed();
    });
  }

  return { collapsed, toggle };
}
