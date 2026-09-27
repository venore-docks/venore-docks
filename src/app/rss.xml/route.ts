import { extractEntryComposition } from "@/contexts/cms";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { extractExcerpt } from "@/platform/seo/entry-excerpt";
import { listPublicEntryLinks } from "@/platform/seo/public-content";
import { getSiteOrigin } from "@/platform/seo/site-origin";

export const dynamic = "force-dynamic";

const FEED_SIZE = 30;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// RSS 2.0 dos últimos conteúdos públicos; ?category=<slug> filtra por categoria (linkado no <head>
// de cada blogroll).
export async function GET(request: Request): Promise<Response> {
  const categorySlug = new URL(request.url).searchParams.get("category") ?? undefined;
  const [origin, brand, { entries, categories }] = await Promise.all([
    getSiteOrigin(),
    getBrandConfig(),
    listPublicEntryLinks({ categorySlug, limit: FEED_SIZE }),
  ]);
  const category = categorySlug ? categories.find((item) => item.slug === categorySlug) : undefined;
  if (categorySlug && !category) {
    return new Response("Categoria não encontrada.", { status: 404 });
  }

  const title = category ? `${category.name} · ${brand.siteName}` : brand.siteName;
  const channelLink = category ? `${origin}/${category.slug}` : `${origin}/`;
  const items = entries
    .map(({ entry, path }) => {
      const link = `${origin}${path}`;
      const description = extractExcerpt(extractEntryComposition(entry.data), 300);
      return [
        "    <item>",
        `      <title>${escapeXml(entry.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        entry.publishedAt ? `      <pubDate>${entry.publishedAt.toUTCString()}</pubDate>` : null,
        description ? `      <description>${escapeXml(description)}</description>` : null,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(brand.footerDescription ?? title)}</description>
    <language>pt-BR</language>
    <atom:link href="${escapeXml(`${origin}/rss.xml${category ? `?category=${category.slug}` : ""}`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
