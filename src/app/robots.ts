import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/platform/seo/site-origin";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getSiteOrigin();
  // Preview da Vercel não deve ser indexado (conteúdo duplicado do site de verdade).
  if (process.env.VERCEL_ENV === "preview") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/visualizar-rascunho/", "/busca", "/login", "/setup", "/forgot-password", "/reset-password", "/post-login", "/pending-approval", "/account", "/unauthorized"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
