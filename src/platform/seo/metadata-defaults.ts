import type { Metadata } from "next";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import { resolveMaintenance } from "@/platform/theme-rendering/resolve-maintenance";
import { resolveDefaultOgImage } from "./og-image";
import { getSiteOrigin } from "./site-origin";

// Metadata padrão do site (root layout), spec §7.7: o generateMetadata de antes da v8, mais a
// imagem padrão de Open Graph do tema/config e o noindex do modo manutenção (quem não é admin vê
// o aviso com status 200 — sem noindex, o aviso entraria no índice no lugar do conteúdo).
export async function resolveThemeMetadataDefaults(): Promise<Metadata> {
  const [{ siteName, footerDescription, faviconUrl }, origin, ogImages, maintenance] = await Promise.all([
    getBrandConfig(),
    getSiteOrigin(),
    resolveDefaultOgImage(),
    getAdminPageData().then((gate) => resolveMaintenance(gate)),
  ]);

  return {
    // Base das URLs relativas de canonical/og:image (SITE_URL ou o host da requisição).
    metadataBase: new URL(origin),
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
    ...(ogImages ? { openGraph: { siteName, images: ogImages } } : {}),
    ...(maintenance ? { robots: { index: false, follow: false } } : {}),
  };
}
