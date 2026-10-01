"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../../i18n/t";
import { useSidebarCollapse } from "../../hooks/use-sidebar-collapse";

// Botão de colapso da rail quando `layout.collapseControl === "header"` (arranjo "rail", Aurora
// 0.1.13). Mora DENTRO do <header>: o header é sticky com z-40 e precisa ficar por cima do resto,
// então um botão filho da rail nunca aparecia sobre ele; como filho do header herda o stacking e
// acompanha o scroll. `start-0` + translate o puxa metade pra fora do header, sobre a borda da rail.
// Só desktop (colapso é conceito de lg+). Estado no store compartilhado com a rail.
export function SidebarCollapseButton({
  collapsed: collapsedFromServer,
  onToggleCollapsed,
  strings,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => Promise<void>;
  strings?: ThemeStrings;
}) {
  const { collapsed, toggle } = useSidebarCollapse(collapsedFromServer, onToggleCollapsed);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? t(strings, "rail.expand") : t(strings, "rail.collapse")}
      data-sidebar-collapse="header"
      className="absolute top-4 start-0 z-10 hidden size-11 -translate-x-1/2 rtl:translate-x-1/2 items-center justify-center rounded-full border border-ring bg-card text-foreground shadow-panel ui-motion-base outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:flex"
    >
      {collapsed ? (
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      ) : (
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
      )}
    </button>
  );
}
