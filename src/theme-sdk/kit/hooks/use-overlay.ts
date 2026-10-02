"use client";

import { useEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";

export const OVERLAY_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type UseOverlayOptions = {
  open: boolean;
  onClose: () => void;
  /** Painel que prende o foco enquanto aberto. */
  containerRef: RefObject<HTMLElement | null>;
  /** Liga a armadilha de foco; função = decidida no momento em que abre (ex.: só abaixo de lg). */
  trapFocus?: boolean | (() => boolean);
  /** Pra onde o foco volta ao fechar; padrão = o elemento focado no instante em que abriu. */
  returnFocus?: () => HTMLElement | null;
  /** Fecha quando a rota muda (padrão true): link dentro da camada navega sem saber dela. */
  closeOnRouteChange?: boolean;
};

// Comportamento comum de camada sobreposta (drawer, tela cheia, folha "Mais") — spec v8 §7.8:
// Escape fecha; troca de rota fecha; enquanto aberta o Tab circula só dentro do painel; ao fechar o
// foco volta pro gatilho. Não decide visual nem trava scroll (useScrollLock é separado e
// ref-contado, pra duas camadas abertas não brigarem).
export function useOverlay({ open, onClose, containerRef, trapFocus = true, returnFocus, closeOnRouteChange = true }: UseOverlayOptions) {
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef(returnFocus);
  const trapRef = useRef(trapFocus);
  const openRef = useRef(open);
  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusRef.current = returnFocus;
    trapRef.current = trapFocus;
    openRef.current = open;
  });

  // Rota mudou com a camada aberta → fecha. Ignora o próprio mount.
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (closeOnRouteChange && openRef.current) onCloseRef.current();
  }, [pathname, closeOnRouteChange]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trap = trapRef.current;
    if (!(typeof trap === "function" ? trap() : trap)) return;
    const panel = containerRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () => Array.from(panel.querySelectorAll<HTMLElement>(OVERLAY_FOCUSABLE_SELECTOR));
    getFocusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel!.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel!.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = returnFocusRef.current?.() ?? previouslyFocused;
      if (target && target.isConnected) target.focus();
    };
  }, [open, containerRef]);
}
