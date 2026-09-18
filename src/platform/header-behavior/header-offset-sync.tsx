"use client";

import { useEffect } from "react";

// Mede a altura real do <header> do tema ativo (todo Shell renderiza exatamente um, confirmado
// nos ~9 temas) e publica em --header-offset — consumida pela regra global
// `[id] { scroll-margin-top: var(--header-offset) }` em globals.css. Sem isso, um link de âncora
// pra outro bloco da MESMA página (Block.htmlId, ver page-builder/composition-tree.ts) rola até o
// topo exato do elemento, mas o header sticky cobre esse topo — bug reportado como "deu um
// pulinho e não acertou a div certa".
//
// Medido em runtime, não hardcoded por tema, porque: (1) sticky é ligado/desligado por admin
// (contexts/settings, ver get-header-behavior.ts) — um header não-sticky não deve empurrar nada;
// (2) scrollShrink muda a altura do header ao passar do limiar de scroll; (3) cada tema tem uma
// altura própria (~56 a 96px) e nem todos respeitam stickyEnabled (paladins nunca é sticky, por
// exemplo) — nenhum desses três fatos é conhecido daqui, só o DOM real é. ResizeObserver cobre os
// três: refaz a leitura sempre que a caixa do header muda de tamanho, seja por qual motivo for.
export function HeaderOffsetSync() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const sync = () => {
      const isPinned = ["sticky", "fixed"].includes(getComputedStyle(header).position);
      const offset = isPinned ? header.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty("--header-offset", `${offset}px`);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return null;
}
