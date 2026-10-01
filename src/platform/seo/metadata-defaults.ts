import type { Metadata } from "next";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { getSiteOrigin } from "./site-origin";

// Metadata padrão do site (root layout). Dono: W4 (og:image do tema/config, ícones). Na Fase F:
// exatamente o generateMetadata que o root layout tinha.
export async function resolveThemeMetadataDefaults(): Promise<Metadata> {
  const { siteName, footerDescription, faviconUrl } = await getBrandConfig();

  return {
    // Base das URLs relativas de canonical/og:image (SITE_URL ou o host da requisição).
    metadataBase: new URL(await getSiteOrigin()),
    alternates: { types: { "application/rss+xml": "/rss.xml" } },
    // Título vem do nome do site configurado (contexts/settings, /admin/settings/brand) — as
    // páginas internas põem só o próprio nome via `title` e o template junta " · <site>".
    title: { default: siteName, template: `%s · ${siteName}` },
    description: footerDescription,
    applicationName: siteName,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: siteName },
    // Sem arquivo-convenção src/app/favicon.ico: o ícone vem SÓ daqui, então o que o admin
    // escolher em /admin/settings/brand (ou o fallback /brand/favicon.ico) é o que o site usa.
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: "/icons/apple-touch-icon.png",
    },
  };
}
