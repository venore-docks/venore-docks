import type { ThemeManifest } from "@/contexts/themes/contracts/types";

export const venoreSlimeManifest: ThemeManifest = {
  key: "venore-slime",
  name: "Venore Slime",
  version: "0.1.0",
  themeContractVersion: "6.0.0",
  // Estética de marca do tema. scrolledSize 92 (era 80): o header agora encolhe pouco no scroll
  // (h-20 → h-14), então a marca acompanha com um passo mais sutil. color = verde de marca
  // profundo (era navy #143b52) — usado como traço de acento no footer e na impressão de PDF.
  brandAesthetics: { mode: "svg", size: 100, scrolledSize: 92, position: "left", color: "#1f5d43" },
  colorModes: ["light", "dark"],
  // O HeaderSlot deste tema lê stickyEnabled/scrollShrinkEnabled — /admin/themes mostra o
  // formulário de comportamento de header só quando este tema está ativo.
  capabilities: { headerBehavior: true },
};
