"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { closeMobileNav, getMobileNavTrigger, useMobileNavOpen } from "./mobile-nav-store";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 1024px == breakpoint `lg` (default do Tailwind, AGENTS.md §4 — sem token JS equivalente
// declarado no projeto). Só abaixo disso o painel é de fato off-canvas; a partir daí ele é a
// coluna estática sempre visível, e prender o foco nela seria errado.
const OFF_CANVAS_MEDIA_QUERY = "(min-width: 1024px)";

// Envolve o conteúdo (nav + toggle admin) já montado pelo SidebarLeftSlot (server component) —
// só a casca que decide overlay/posição/Escape é client. Abaixo de lg vira off-canvas fechado
// por padrão; a partir de lg os estilos de drawer são neutralizados e ela volta a ser a coluna
// fixa (classes lg: do próprio SidebarLeftSlot cuidam disso).
export function MobileNavDrawer({ children, asideClassName }: { children: ReactNode; asideClassName: string }) {
  const isOpen = useMobileNavOpen();
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  // `isOpen` vive num store externo ao módulo (mobile-nav-store.ts), não resetado por navegação
  // client-side (SPA) — sobrevive normalmente entre páginas. SidebarNavLink não fecha o drawer no
  // clique (é só <Link>, sem onClick próprio, e não deveria precisar saber do drawer pra navegar).
  // Sem isto, navegar por um link de dentro do drawer aberto deixava `isOpen` preso em `true`: o
  // botão-backdrop abaixo (fixed inset-0 z-40) continuava montado em toda página seguinte, abaixo
  // de `lg`, engolindo todo clique da UI real por trás dele — bug real, "nada acontece" ao tocar
  // em qualquer botão, sem erro nenhum (achado: /admin/media, mas afeta qualquer página). Fecha
  // sempre que a rota muda enquanto aberto; ignora o próprio mount (não fecha um drawer que acabou
  // de abrir por causa da primeira renderização desta página).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    closeMobileNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a pathname; closeMobileNav é estável (módulo, não recriada)
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobileNav();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Foco preso dentro do painel enquanto aberto e devolvido ao gatilho ao fechar — só faz
  // sentido abaixo de `lg`, onde o painel é de fato off-canvas (ver OFF_CANVAS_MEDIA_QUERY).
  useEffect(() => {
    if (!isOpen) return;
    if (window.matchMedia(OFF_CANVAS_MEDIA_QUERY).matches) return;

    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    getFocusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      getMobileNavTrigger()?.focus();
    };
  }, [isOpen]);

  // Trava o scroll do body enquanto o drawer está aberto, sem salto de posição: em vez de só
  // overflow:hidden (que ainda permite rubber-band scroll no iOS Safari), fixa o body na
  // posição atual e restaura o scroll exato ao fechar.
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const { body } = document;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Fechar navegação"
          onClick={closeMobileNav}
          className="fixed inset-0 z-40 bg-popover/80 lg:hidden"
        />
      )}
      <div
        ref={panelRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] ui-motion-emphasis",
          "lg:static lg:z-auto lg:w-auto lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:transition-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <aside className={cn(asideClassName, "overscroll-contain")}>{children}</aside>
      </div>
    </>
  );
}
