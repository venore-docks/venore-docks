import type { ReactNode } from "react";
import type { ContentSlotProps } from "@/contexts/themes/contracts/types";
import type { ContextualBarPlacement, ContextualBarRegionProps, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "../regions/breadcrumbs/breadcrumbs";
import { regionText } from "../regions/region-strings";
import { KIT_MAIN_CONTENT_ID } from "./skip-link";

export type ContextualMobileMode = ContextualBarRegionProps["mobile"];

// Moldura de conteúdo do kit (ex-ContentSlot do venore-slime): trilha + coluna principal + barra
// contextual. `ContentFrame` recebe as regiões já renderizadas (caminho v8: ThemeRenderer);
// `ContentSlot` mantém a assinatura 7.x pro Shell. Dono: W3 (layouts do kit).
//
// `<main id="conteudo">` é o alvo do SkipLink (spec v8 §2.5). A barra contextual:
//   placement "side" (padrão) → <aside> ao lado do <main> a partir de lg; "top" → <aside> acima do
//   <main>, de largura total.
//   mobile (abaixo de lg, spec §7.8 `contextualBarMobile`): "bottom" (padrão, o slime de sempre) →
//   empilhada depois do <main>; "hidden" → some; "top-collapsible" → um <details> antes do <main>
//   (a cópia do <aside> fica só de lg pra cima).
export function ContentFrame({
  children,
  breadcrumbs,
  contextualBar,
  contextualPlacement = "side",
  contextualMobile = "bottom",
  strings,
}: {
  children: ReactNode;
  breadcrumbs: ReactNode | null;
  contextualBar: ReactNode | null;
  contextualPlacement?: ContextualBarPlacement;
  contextualMobile?: ContextualMobileMode;
  strings?: ThemeStrings;
}) {
  const showSidebar = contextualBar != null && contextualPlacement !== "none";
  const isTop = contextualPlacement === "top";
  const desktopOnly = contextualMobile !== "bottom";

  const aside = showSidebar ? (
    <aside
      data-region="contextual"
      className={cn("w-full shrink-0 text-foreground", !isTop && "lg:w-72", desktopOnly && "hidden lg:block")}
    >
      {contextualBar}
    </aside>
  ) : null;

  const mobileDisclosure =
    showSidebar && contextualMobile === "top-collapsible" ? (
      <details data-contextual-mobile="top-collapsible" className="group/contextual w-full rounded-panel border border-border bg-card text-foreground lg:hidden">
        <summary className="cursor-pointer list-none rounded-panel px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          {regionText(strings, "contextual.mobileSummary")}
        </summary>
        <div data-region="contextual" className="border-t border-border px-2 py-3">
          {contextualBar}
        </div>
      </details>
    ) : null;

  return (
    <div data-sidebar-contextual={showSidebar} className="flex-1 min-w-0 bg-(image:--app-background)">
      {breadcrumbs}
      <div
        className={`mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:gap-10 lg:px-8 lg:py-12 ${
          showSidebar ? (isTop ? "flex-col" : "flex-col lg:flex-row") : ""
        }`}
      >
        {mobileDisclosure}
        {isTop && aside}
        <main id={KIT_MAIN_CONTENT_ID} data-region="content" className="min-w-0 flex-1 text-foreground">
          {children}
        </main>
        {!isTop && aside}
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
      strings={strings}
    >
      {children}
    </ContentFrame>
  );
}
