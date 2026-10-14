import type { ResolvedThemeDefinition } from "@/contexts/themes/contracts/v8";

// Dado estruturado por template (spec §7.7), sempre a partir de DTO JÁ filtrado por visibilidade
// (C7): a página só chama isto para conteúdo "public" — entry "authenticated" vira 404 para
// visitante e, para quem tem sessão, sai sem JSON-LD (é noindex de qualquer forma). Serializado no
// core por <CoreJsonLd> (serializeJsonLd escapa `<`, `>` e `&`, fechando o `</script>`). O tipo
// schema.org vem de seo.structuredData do tema; sem declaração, o padrão abaixo.
export type TemplateJsonLdInput =
  | { kind: "home"; siteName: string; url: string; description?: string | null; logoUrl?: string | null }
  | {
      kind: "entry";
      title: string;
      url: string;
      publishedAt: string | null;
      updatedAt: string | null;
      image: string | null;
      description?: string | null;
      siteName?: string | null;
    }
  | {
      kind: "category";
      name: string;
      url: string;
      description: string | null;
      items?: readonly { title: string; url: string }[];
    };

const DEFAULT_TYPES = { home: "WebSite", entry: "Article", category: "CollectionPage" } as const;

function compact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""));
}

export function buildTemplateJsonLd(
  theme: Pick<ResolvedThemeDefinition, "seo">,
  input: TemplateJsonLdInput,
): Record<string, unknown> | null {
  const declared = theme.seo.structuredData ?? {};
  switch (input.kind) {
    case "home": {
      const type = declared.home ?? DEFAULT_TYPES.home;
      return compact({
        "@context": "https://schema.org",
        "@type": type,
        name: input.siteName,
        url: input.url,
        description: input.description,
        logo: type === "Organization" ? input.logoUrl : undefined,
      });
    }
    case "entry": {
      const type = declared.entry ?? DEFAULT_TYPES.entry;
      const isArticle = type !== "WebPage";
      return compact({
        "@context": "https://schema.org",
        "@type": type,
        [isArticle ? "headline" : "name"]: input.title,
        url: input.url,
        mainEntityOfPage: isArticle ? input.url : undefined,
        description: input.description,
        datePublished: input.publishedAt,
        dateModified: input.updatedAt ?? input.publishedAt,
        image: input.image ? [input.image] : undefined,
        publisher: isArticle && input.siteName ? { "@type": "Organization", name: input.siteName } : undefined,
      });
    }
    case "category": {
      const type = declared.category ?? DEFAULT_TYPES.category;
      const items = input.items ?? [];
      return compact({
        "@context": "https://schema.org",
        "@type": type,
        name: input.name,
        url: input.url,
        description: input.description,
        mainEntity:
          items.length > 0
            ? {
                "@type": "ItemList",
                itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title, url: item.url })),
              }
            : undefined,
      });
    }
  }
}
