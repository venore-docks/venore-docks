"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../../i18n/t";
import { regionText } from "../region-strings";
import { useOverlay } from "../../hooks/use-overlay";
import { useScrollLock } from "../../hooks/use-scroll-lock";
import { closeMobileNav, getMobileNavTrigger, useMobileNavOpen } from "../../stores/mobile-nav-store";

export const KIT_MOBILE_NAV_PANEL_ID = "kit-mobile-nav";

// Camada da navegação mobile quando ela NÃO é a própria rail (spec v8 §7.8):
//   "drawer"     → painel off-canvas lateral (só quando não há rail pra fazer esse papel);
//   "fullscreen" → sobreposição de tela cheia.
// Aberta/fechada pelo MESMO store do hambúrguer do header (MobileNavToggleButton, aria-expanded).
// Fechada, o painel continua no HTML (o <nav> rotulado existe desde o SSR) mas `inert`/`hidden`,
// fora da árvore de acessibilidade e do Tab. Aberta: Escape, troca de rota, foco preso e devolvido
// ao gatilho (useOverlay) e scroll travado com contagem de referência (useScrollLock).
export function MobileNavOverlay({
  variant,
  strings,
  children,
}: {
  variant: "drawer" | "fullscreen";
  strings?: ThemeStrings;
  children: ReactNode;
}) {
  const open = useMobileNavOpen();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay({ open, onClose: closeMobileNav, containerRef: panelRef, returnFocus: getMobileNavTrigger });
  useScrollLock(open);

  const nav = (
    <nav aria-label={regionText(strings, "mobileNav.label")} data-region="mobile-nav" data-mobile-nav={variant}>
      {children}
    </nav>
  );

  if (variant === "fullscreen") {
    return (
      <div
        ref={panelRef}
        id={KIT_MOBILE_NAV_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-label={regionText(strings, "mobileNav.label")}
        hidden={!open}
        className="fixed inset-0 z-50 flex flex-col gap-6 overflow-y-auto overscroll-contain bg-background px-4 py-4 text-foreground lg:hidden"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeMobileNav}
            aria-label={t(strings, "mobileNav.close")}
            className="ui-icon-button-lg ui-motion-base outline-none hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {nav}
      </div>
    );
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t(strings, "mobileNav.close")}
          onClick={closeMobileNav}
          className="fixed inset-0 z-40 bg-popover/80 lg:hidden"
        />
      )}
      <div
        ref={panelRef}
        id={KIT_MOBILE_NAV_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-label={regionText(strings, "mobileNav.label")}
        inert={!open}
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-64 max-w-[85vw] overflow-y-auto overscroll-contain bg-card px-5 py-6 text-foreground shadow-float ui-motion-emphasis lg:hidden",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        {nav}
      </div>
    </>
  );
}
