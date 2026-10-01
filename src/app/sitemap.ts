import type { MetadataRoute } from "next";
import { listPublicEntryLinks } from "@/platform/seo/public-content";
import { getSiteOrigin } from "@/platform/seo/site-origin";

// Dinâmico: o conteúdo muda em runtime (publicação pelo admin), não no build.
export const dynamic = "force-dynamic";

// Home, categorias (blogroll) e todo conteúdo publicado e público. Conteúdo "authenticated" e
// rotas de plugin ficam de fora.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getSiteOrigin();
  const { entries, categories } = await listPublicEntryLinks();

  return [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1 },
    ...categories.map((category) => ({ url: `${origin}/${category.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...entries.map(({ entry, path }) => ({
      url: `${origin}${path}`,
      lastModified: entry.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
