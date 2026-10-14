"use client";

import { useEffect } from "react";

// Trava de scroll do body com CONTAGEM DE REFERÊNCIA (spec v8 §7.8): duas camadas abertas ao mesmo
// tempo (ex.: drawer + folha "Mais") travam uma vez só, e o body só é destravado quando a ÚLTIMA
// solta — fechar a camada de cima nunca libera o scroll por baixo da outra. Em vez de só
// overflow:hidden (que ainda deixa o rubber-band do iOS Safari rolar), fixa o body na posição atual
// e devolve o scroll exato ao destravar (comportamento herdado do MobileNavDrawer do slime).
let lockCount = 0;
let saved: { position: string; top: string; width: string; scrollY: number } | null = null;

function applyLock() {
  const { body } = document;
  const scrollY = window.scrollY;
  saved = { position: body.style.position, top: body.style.top, width: body.style.width, scrollY };
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";
}

function releaseLock() {
  if (!saved) return;
  const { body } = document;
  body.style.position = saved.position;
  body.style.top = saved.top;
  body.style.width = saved.width;
  const { scrollY } = saved;
  saved = null;
  window.scrollTo(0, scrollY);
}

/** Trava o scroll e devolve a função que solta ESTA trava (idempotente). */
export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) applyLock();
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) releaseLock();
  };
}

export function getScrollLockCount(): number {
  return lockCount;
}

export function useScrollLock(active: boolean) {
  useEffect(() => (active ? lockScroll() : undefined), [active]);
}
