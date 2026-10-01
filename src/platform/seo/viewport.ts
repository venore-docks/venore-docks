import type { Viewport } from "next";
import { CHROME_DARK } from "./web-manifest";

// Viewport do root layout (spec §7.7). Dono: W4 (themeColor light/dark a partir de seo.themeColor
// ou dos tokens do tema). Na Fase F: o valor estático de hoje.
// viewportFit: "cover" habilita as env(safe-area-inset-*) em telas com notch/ilha (standalone).
export async function generateViewport(): Promise<Viewport> {
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: CHROME_DARK,
  };
}
