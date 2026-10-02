import type { Viewport } from "next";
import type { DocumentModel } from "@/contexts/themes/contracts/v8";
import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import { resolveThemeChromeColors } from "./theme-color";

// Paleta efetiva do documento (seção vence a do tema), a mesma que buildPaletteCss aplica.
export function documentPaletteChoice(doc: Pick<DocumentModel, "config" | "section" | "theme">) {
  return doc.section?.palette ?? doc.config.byTheme[doc.theme.key]?.palette;
}

// Viewport do root layout (spec §7.7): themeColor claro/escuro do tema (seo.themeColor, ou
// --header-bg sob "from-tokens"); sem declaração — o venore-slime — o #171717 de sempre.
// viewportFit: "cover" habilita as env(safe-area-inset-*) em telas com notch/ilha (standalone).
export function buildViewport(colors: { light: string; dark: string }): Viewport {
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor:
      colors.light === colors.dark
        ? colors.light
        : [
            { media: "(prefers-color-scheme: light)", color: colors.light },
            { media: "(prefers-color-scheme: dark)", color: colors.dark },
          ],
  };
}

export async function generateViewport(): Promise<Viewport> {
  const doc = await resolveDocumentModel();
  return buildViewport(resolveThemeChromeColors(doc.theme, documentPaletteChoice(doc)));
}
