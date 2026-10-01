"use client";

import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleMobileNav, useMobileNavOpen } from "./mobile-nav-store";

// Único pedaço client do Header além de HeaderScrollSentinel — o botão em si (precisa do estado
// aberto/fechado do drawer). Abaixo de lg abre/fecha o drawer da SidebarLeft; a partir de lg fica
// oculto pois a sidebar volta a ser fixa. Sem variante de "scrolled": no refator premium o header
// não inverte de cor.
export function MobileNavToggleButton() {
  const isOpen = useMobileNavOpen();

  return (
    <button
      type="button"
      onClick={toggleMobileNav}
      aria-label={isOpen ? "Fechar navegação" : "Abrir navegação"}
      aria-expanded={isOpen}
      className={cn(
        "ui-icon-button-lg ui-motion-base outline-none hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden",
      )}
    >
      {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
    </button>
  );
}
