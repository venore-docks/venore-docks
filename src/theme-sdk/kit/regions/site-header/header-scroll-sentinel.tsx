"use client";

import { useEffect, useRef } from "react";

const HEADER_ELEMENT_ID = "site-header";
// Histerese assimétrica (docs/ui/shell-spec.md §2.2): entra em "scrolled" só depois de passar
// ENTER_THRESHOLD_PX, só volta a "top" abaixo de EXIT_THRESHOLD_PX — a banda morta entre os dois
// evita flicker quando o usuário para o scroll perto de um limiar único.
const ENTER_THRESHOLD_PX = 96;
const EXIT_THRESHOLD_PX = 18;

// Único pedaço client da detecção de scroll do header — nem o <header> em si, nem brand/nav/user
// menu precisam virar client component: todos reagem ao atributo `data-scrolled` escrito aqui via
// seletor CSS (`data-[scrolled=true]` / `group-data-[scrolled=true]/header`), não via prop React.
// Detecção por IntersectionObserver sobre duas sentinelas de 1px (uma por limiar), não por
// listener de `scroll` — o wrapper tem `h-0` de propósito: não reserva espaço nenhum no fluxo do
// layout (zero layout shift), as sentinelas só existem para o observer ter algo a observar.
export function HeaderScrollSentinel() {
  const enterRef = useRef<HTMLSpanElement>(null);
  const exitRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = document.getElementById(HEADER_ELEMENT_ID);
    const enterEl = enterRef.current;
    const exitEl = exitRef.current;
    if (!header || !enterEl || !exitEl) return;

    function apply(nextScrolled: boolean) {
      if (header!.dataset.scrolled === String(nextScrolled)) return;
      header!.dataset.scrolled = String(nextScrolled);
    }

    // Leitura pontual no mount (não um listener contínuo) pra evitar flash entre o primeiro paint
    // e o primeiro callback assíncrono do IntersectionObserver, ex.: restauração de scroll do
    // navegador (voltar/avançar) com a página já rolada.
    apply(window.scrollY > ENTER_THRESHOLD_PX);

    const enterObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) apply(true);
      },
      { threshold: 0 },
    );
    const exitObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) apply(false);
      },
      { threshold: 0 },
    );

    enterObserver.observe(enterEl);
    exitObserver.observe(exitEl);

    return () => {
      enterObserver.disconnect();
      exitObserver.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="relative h-0 w-0 overflow-visible">
      <span ref={enterRef} className="absolute left-0 h-px w-px" style={{ top: ENTER_THRESHOLD_PX }} />
      <span ref={exitRef} className="absolute left-0 h-px w-px" style={{ top: EXIT_THRESHOLD_PX }} />
    </div>
  );
}
