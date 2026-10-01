import type { ReactNode } from "react";
import type { ContentSlotProps } from "@/contexts/themes/contracts/types";
import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { Breadcrumbs } from "../regions/breadcrumbs/breadcrumbs";

// Moldura de conteúdo do kit (ex-ContentSlot do venore-slime, movido sem mudança de markup):
// trilha + coluna principal + barra contextual lateral. `ContentFrame` recebe as regiões já
// renderizadas (caminho v8: ThemeRenderer); `ContentSlot` mantém a assinatura 7.x pro Shell.
// Dono a partir da Fase F: W3 (layouts do kit).
export function ContentFrame({
  children,
  breadcrumbs,
  contextualBar,
}: {
  children: ReactNode;
  breadcrumbs: ReactNode | null;
  contextualBar: ReactNode | null;
}) {
  const showSidebar = contextualBar != null;

  return (
    <div data-sidebar-contextual={showSidebar} className="flex-1 min-w-0 bg-(image:--app-background)">
      {breadcrumbs}
      <div
        className={`mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:gap-10 lg:px-8 lg:py-12 ${
          showSidebar ? "flex-col lg:flex-row" : ""
        }`}
      >
        <main data-region="content" className="min-w-0 flex-1 text-foreground">
          {children}
        </main>
        {showSidebar && (
          <aside data-region="contextual" className="w-full shrink-0 text-foreground lg:w-72">
            {contextualBar}
          </aside>
        )}
      </div>
    </div>
  );
}

export function ContentSlot({
  children,
  sidebarContextualEnabled,
  sidebarContextual,
  breadcrumbs,
  breadcrumbsJsonLd,
  strings,
}: ContentSlotProps & { strings?: ThemeStrings }) {
  const showSidebar = sidebarContextualEnabled && sidebarContextual != null;

  return (
    <ContentFrame
      breadcrumbs={<Breadcrumbs breadcrumbs={breadcrumbs} breadcrumbsJsonLd={breadcrumbsJsonLd} strings={strings} />}
      contextualBar={showSidebar ? sidebarContextual : null}
    >
      {children}
    </ContentFrame>
  );
}
