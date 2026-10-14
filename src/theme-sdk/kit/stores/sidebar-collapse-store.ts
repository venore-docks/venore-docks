"use client";

// Estado de colapso da rail (desktop) compartilhado entre quem APLICA a largura (a região rail) e
// quem pode ALTERNAR (o botão dentro da rail, ou o do header no arranjo "rail" — Aurora 0.1.13).
// São regiões irmãs sem ancestral client comum, então o estado vive fora da árvore React (mesmo
// motivo de mobile-nav-store.ts). `null` = ainda não alternado nesta sessão do navegador: vale o
// valor que o servidor resolveu do cookie (`collapsed` das props), inclusive no SSR — sem flash.
// Persistência é da Server Action (cookie); este store é só o lado otimista (spec v8 §7.8).
import { useSyncExternalStore } from "react";

let collapsedOverride: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSidebarCollapsed(fromServer: boolean): boolean {
  return useSyncExternalStore(
    subscribe,
    () => collapsedOverride ?? fromServer,
    () => fromServer,
  );
}

export function setSidebarCollapsed(value: boolean) {
  collapsedOverride = value;
  for (const listener of listeners) listener();
}

/** Só pra teste: volta ao "nunca alternado". */
export function resetSidebarCollapseStore() {
  collapsedOverride = null;
  for (const listener of listeners) listener();
}
