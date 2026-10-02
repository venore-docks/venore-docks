"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../../i18n/t";
import { useOverlay } from "../../hooks/use-overlay";
import { useScrollLock } from "../../hooks/use-scroll-lock";
import { closeMobileNav, getMobileNavTrigger, useMobileNavOpen } from "../../stores/mobile-nav-store";

// 1024px == breakpoint `lg` (default do Tailwind, AGENTS.md §4 — sem token JS equivalente
// declarado no projeto). Só abaixo disso o painel é de fato off-canvas; a partir daí ele é a
// coluna estática sempre visível, e prender o foco nela seria errado.
const OFF_CANVAS_MEDIA_QUERY = "(min-width: 1024px)";

function isOffCanvasViewport() {
  return !window.matchMedia(OFF_CANVAS_MEDIA_QUERY).matches;
}

// Casca client da rail: envolve o conteúdo (nav + toggle admin) já montado pela região. Abaixo de
// lg, no modo de navegação mobile "drawer", vira off-canvas fechado por padrão (scrim, Escape,
// foco preso e devolvido ao gatilho, scroll travado — tudo via useOverlay/useScrollLock); a partir
// de lg os estilos de drawer são neutralizados e ela volta a ser a coluna fixa.
//
// `offCanvas=false` (modos "bottom-bar" e "fullscreen", que têm a própria camada): abaixo de lg a
// rail simplesmente não aparece — nunca abre junto com a camada do outro modo.
// `arrangement="rail"` (Aurora 0.1.13): a partir de lg a coluna é sticky na altura da tela (o menu
// rola dentro do <nav>, nunca some ao rolar a página), e o scrim ganha um leve desfoque.
//
// O `isOpen` vive no store (mobile-nav-store.ts), não resetado por navegação client-side. Link de
// dentro do drawer só navega (não sabe do drawer) — por isso useOverlay fecha em troca de rota;
// sem isso o scrim (fixed inset-0 z-40) ficava montado engolindo todo clique da página seguinte.
export function MobileNavDrawer({
  children,
  asideClassName,
  strings,
  offCanvas = true,
  arrangement = "topbar",
}: {
  children: ReactNode;
  asideClassName: string;
  strings?: ThemeStrings;
  offCanvas?: boolean;
  arrangement?: "topbar" | "rail";
}) {
  const storeOpen = useMobileNavOpen();
  const isOpen = offCanvas && storeOpen;
  const panelRef = useRef<HTMLDivElement>(null);

  useOverlay({
    open: isOpen,
    onClose: closeMobileNav,
    containerRef: panelRef,
    trapFocus: isOffCanvasViewport,
    returnFocus: getMobileNavTrigger,
    closeOnRouteChange: offCanvas,
  });
  useScrollLock(isOpen);

  const isRail = arrangement === "rail";

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label={t(strings, "mobileNav.close")}
          onClick={closeMobileNav}
          className={cn("fixed inset-0 z-40 bg-popover/80 lg:hidden", isRail && "backdrop-blur-xs")}
        />
      )}
      <div
        ref={panelRef}
        className={cn(
          offCanvas
            ? cn(
                "fixed inset-y-0 start-0 z-50 w-64 max-w-[85vw] ui-motion-emphasis",
                isRail
                  ? "lg:sticky lg:top-0 lg:h-dvh lg:z-auto lg:w-auto lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:transition-none"
                  : "lg:static lg:z-auto lg:w-auto lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:transition-none",
                isOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
              )
            : cn("hidden lg:block lg:shrink-0", isRail && "lg:sticky lg:top-0 lg:h-dvh"),
        )}
      >
        <aside data-region="rail" className={cn(asideClassName, "overscroll-contain")}>{children}</aside>
      </div>
    </>
  );
}
