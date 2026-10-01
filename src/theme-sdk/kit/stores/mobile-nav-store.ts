"use client";

// Store externo mínimo (useSyncExternalStore) para o estado aberto/fechado do drawer de
// navegação mobile — Header (hamburger) e SidebarLeft (drawer) são slots irmãos no layout
// (não há ancestral comum client-side pra um Context), então o estado vive fora da árvore
// React e cada lado assina via hook. Mantém HeaderSlot/SidebarLeftSlot como server components;
// só quem chama o hook precisa de "use client".
import { useSyncExternalStore } from "react";

let isOpen = false;
// Elemento com foco no momento em que o drawer abriu (o gatilho, tipicamente
// MobileNavToggleButton) — MobileNavDrawer devolve o foco pra ele ao fechar (docs/ui/
// shell-spec.md, requisito de acessibilidade "foco devolvido ao gatilho"). Guardado aqui, não no
// próprio botão, pelo mesmo motivo do isOpen: Header e SidebarLeft são slots irmãos sem ancestral
// client comum.
let lastTrigger: HTMLElement | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return isOpen;
}

function getServerSnapshot() {
  return false;
}

function captureTrigger() {
  if (typeof document !== "undefined") {
    lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
}

export function openMobileNav() {
  captureTrigger();
  isOpen = true;
  emitChange();
}

export function closeMobileNav() {
  isOpen = false;
  emitChange();
}

export function toggleMobileNav() {
  if (!isOpen) captureTrigger();
  isOpen = !isOpen;
  emitChange();
}

export function useMobileNavOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getMobileNavTrigger(): HTMLElement | null {
  return lastTrigger;
}
