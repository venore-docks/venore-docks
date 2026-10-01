"use client";

// PreviewBridge (spec §7.2): montado só quando há override de preview ativo; recebe tokens/opções
// por postMessage do /admin/themes/customize. Dono: W6 — na Fase F não há override, então o
// componente não faz nada.
export function PreviewBridge(): null {
  return null;
}
