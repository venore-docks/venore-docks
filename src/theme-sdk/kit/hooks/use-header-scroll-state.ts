"use client";

import { useEffect, type RefObject } from "react";

// Estado de scroll do header (spec v8 §7.8): duas sentinelas de 1px observadas por
// IntersectionObserver (nunca listener de `scroll`), com histerese — entra em "scrolled" quando a
// sentinela de entrada sai da tela, só volta a "top" quando a de saída reaparece. Escreve
// `data-scrolled` direto no <header> (`#site-header`, com fallback pro primeiro `header`, mesmo
// critério do HeaderOffsetSync): ninguém re-renderiza, tudo reage por seletor CSS.
export function findHeaderElement(id = "site-header"): HTMLElement | null {
  return document.getElementById(id) ?? document.querySelector("header");
}

export function useHeaderScrollState({
  enterRef,
  exitRef,
  enterThresholdPx,
  headerId = "site-header",
}: {
  enterRef: RefObject<HTMLElement | null>;
  exitRef: RefObject<HTMLElement | null>;
  enterThresholdPx: number;
  headerId?: string;
}) {
  useEffect(() => {
    const header = findHeaderElement(headerId);
    const enterEl = enterRef.current;
    const exitEl = exitRef.current;
    if (!header || !enterEl || !exitEl || typeof IntersectionObserver === "undefined") return;

    function apply(nextScrolled: boolean) {
      if (header!.dataset.scrolled === String(nextScrolled)) return;
      header!.dataset.scrolled = String(nextScrolled);
    }

    // Leitura pontual no mount: evita flash entre o primeiro paint e o primeiro callback do
    // observer (ex.: restauração de scroll do navegador com a página já rolada).
    apply(window.scrollY > enterThresholdPx);

    const enterObserver = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting) apply(true);
    }, { threshold: 0 });
    const exitObserver = new IntersectionObserver(([entry]) => {
      if (entry && entry.isIntersecting) apply(false);
    }, { threshold: 0 });
    enterObserver.observe(enterEl);
    exitObserver.observe(exitEl);
    return () => {
      enterObserver.disconnect();
      exitObserver.disconnect();
    };
  }, [enterRef, exitRef, enterThresholdPx, headerId]);
}
