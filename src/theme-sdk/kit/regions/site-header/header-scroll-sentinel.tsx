"use client";

import { useRef } from "react";
import { useHeaderScrollState } from "../../hooks/use-header-scroll-state";

// Histerese assimétrica (docs/ui/shell-spec.md §2.2): entra em "scrolled" só depois de passar
// ENTER_THRESHOLD_PX, só volta a "top" abaixo de EXIT_THRESHOLD_PX — a banda morta entre os dois
// evita flicker quando o usuário para o scroll perto de um limiar único.
const ENTER_THRESHOLD_PX = 96;
const EXIT_THRESHOLD_PX = 18;

// Único pedaço client da detecção de scroll do header — nem o <header> em si, nem brand/nav/user
// menu precisam virar client component: todos reagem ao atributo `data-scrolled` escrito pelo
// hook useHeaderScrollState via seletor CSS (`data-[scrolled=true]` /
// `group-data-[scrolled=true]/header`), não via prop React. O wrapper tem `h-0` de propósito: não
// reserva espaço nenhum no fluxo do layout (zero layout shift), as sentinelas só existem para o
// observer ter algo a observar.
export function HeaderScrollSentinel() {
  const enterRef = useRef<HTMLSpanElement>(null);
  const exitRef = useRef<HTMLSpanElement>(null);
  useHeaderScrollState({ enterRef, exitRef, enterThresholdPx: ENTER_THRESHOLD_PX });

  return (
    <div aria-hidden className="relative h-0 w-0 overflow-visible">
      <span ref={enterRef} className="absolute start-0 h-px w-px" style={{ top: ENTER_THRESHOLD_PX }} />
      <span ref={exitRef} className="absolute start-0 h-px w-px" style={{ top: EXIT_THRESHOLD_PX }} />
    </div>
  );
}
