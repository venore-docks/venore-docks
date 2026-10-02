import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EntryTemplateProps, ResolvedThemeDefinition, ThemeSectionOverride } from "@/contexts/themes/contracts/v8";

// Páginas com template (spec v8 §12, W4): C7 (entry "authenticated" → 404 sem JSON-LD), escape de
// `</script>` no JSON-LD, home com UMA consulta de entry, variante de template vinda da entry ou da
// seção, 404 dentro da Shell e manutenção no <head>.

const state = vi.hoisted(() => ({
  user: null as null | { id: string; name: string | null; email: string },
  homeEntry: null as null | Record<string, unknown>,
  category: null as null | { id: string; name: string; slug: string; description: string | null },
  entry: null as null | Record<string, unknown>,
  listed: [] as Record<string, unknown>[],
  theme: null as unknown as ResolvedThemeDefinition,
  section: null as ThemeSectionOverride | null,
  maintenance: false,
  calls: { publishedBySlug: 0, composition: 0 },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  unstable_rethrow: () => {},
  usePathname: () => "/",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "n0nce" }) }));
vi.mock("@/platform/seo/site-origin", () => ({ getSiteOrigin: async () => "https://site.test" }));
vi.mock("@/platform/seo/og-image", () => ({ resolveDefaultOgImage: async () => [{ url: "https://site.test/og.png" }] }));
vi.mock("@/platform/theme-rendering/resolve-maintenance", () => ({
  resolveMaintenance: async (gate: { granted: boolean }) => state.maintenance && !gate.granted,
  readMaintenanceSetting: async () => ({ enabled: state.maintenance, message: "" }),
}));
vi.mock("@/platform/theme-rendering/document-model", () => ({
  resolveDocumentModel: async () => ({
    pathname: "/",
    area: "public",
    theme: state.theme,
    config: { assets: {}, byTheme: {}, sections: [] },
    section: state.section,
    options: { values: {}, ignored: [] },
    locale: "pt-BR",
    dir: "ltr",
  }),
}));
vi.mock("@/contexts/cms", () => ({
  extractEntryComposition: (data: { composition?: unknown[] } | null) => data?.composition ?? null,
  getEntryBody: (data: { body?: string } | null) => data?.body ?? "",
  getCachedCategoryBySlug: async (slug: string) => ({
    success: true,
    data: state.category && state.category.slug === slug ? state.category : null,
  }),
  getCachedPublishedEntryBySlug: async () => ({ success: true, data: state.entry }),
  getPublishedEntryBySlug: async () => {
    state.calls.publishedBySlug += 1;
    return { success: true, data: state.homeEntry };
  },
  getEntryComposition: async () => {
    state.calls.composition += 1;
    return { success: true, data: null };
  },
  listEntries: async () => ({ success: true, data: state.listed }),
  recordEntryView: () => {},
}));
vi.mock("@/contexts/auth", () => ({ getCurrentUser: async () => ({ success: true, data: state.user }) }));
vi.mock("@/contexts/media", () => ({
  getMediaAssetUrls: async ({ ids }: { ids: string[] }) => ({
    success: true,
    data: Object.fromEntries(ids.map((id) => [id, `/media/${id}.jpg`])),
  }),
}));
vi.mock("@/platform/brand/get-brand-config", () => ({
  getBrandConfig: async () => ({ siteName: "Venore Docks", logoUrl: "/brand/brand-logo.svg" }),
}));
vi.mock("@/platform/plugin-routing/resolve-public-route", () => ({
  resolvePublicPluginRoute: async () => ({ kind: "not-a-plugin-route" }),
}));
vi.mock("@/platform/admin-shell/get-admin-page-data", () => ({ getAdminPageData: async () => ({ granted: false }) }));
vi.mock("@/platform/plugin-engine/get-active-plugin-keys", () => ({ getActivePluginKeys: async () => new Set<string>() }));
vi.mock("@/plugins/contributions", () => ({ PLUGIN_CONTRIBUTIONS: {} }));
vi.mock("@/components/page-builder/block-renderer", () => ({
  BlockRenderer: ({ blocks }: { blocks: unknown[] }) => <div data-test-blocks="">{blocks.length} blocos</div>,
}));

async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveAsync));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
    return resolveAsync(await (element.type as (props: unknown) => Promise<ReactNode>)(element.props));
  }
  if (element.props && "children" in element.props) {
    return { ...element, props: { ...element.props, children: await resolveAsync(element.props.children) } } as ReactElement;
  }
  return element;
}
const html = async (page: Promise<ReactNode> | ReactNode) => renderToStaticMarkup(<>{await resolveAsync(await page)}</>);
const params = (slug: string[]) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
const jsonLdOf = (markup: string) =>
  [...markup.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));

const publishedAt = new Date("2026-03-15T12:00:00Z");
const updatedAt = new Date("2026-03-16T12:00:00Z");
const blog = { id: "cat-1", name: "Blog", slug: "blog", description: null };

async function slime(): Promise<ResolvedThemeDefinition> {
  const { resolveThemeDefinition } = await import("@/platform/theme-rendering/resolve-theme-definition");
  return resolveThemeDefinition("venore-slime").theme;
}

beforeEach(async () => {
  state.user = null;
  state.homeEntry = null;
  state.category = null;
  state.entry = null;
  state.listed = [];
  state.section = null;
  state.maintenance = false;
  state.calls = { publishedBySlug: 0, composition: 0 };
  state.theme = await slime();
});

describe("C7 — entry authenticated", () => {
  const closed = () => ({ id: "e1", title: "Só membros", slug: "fechado", visibility: "authenticated", publishedAt, updatedAt, mediaId: null, data: {} });

  it("visitante sem sessão: 404 (notFound) e nenhum metadata/JSON-LD", async () => {
    const { default: CatchAllPage, generateMetadata } = await import("./[...slug]/page");
    state.entry = closed();
    await expect(CatchAllPage(params(["fechado"]))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await generateMetadata(params(["fechado"]))).toEqual({});
  });

  it("com sessão: a página renderiza, mas sem JSON-LD (é noindex)", async () => {
    const { default: CatchAllPage, generateMetadata } = await import("./[...slug]/page");
    state.entry = closed();
    state.user = { id: "u1", name: "Ana", email: "ana@example.com" };
    const markup = await html(CatchAllPage(params(["fechado"])));
    expect(markup).toContain("Só membros");
    expect(jsonLdOf(markup)).toEqual([]);
    expect((await generateMetadata(params(["fechado"]))).robots).toEqual({ index: false, follow: false });
  });

  it("listagem: o JSON-LD da categoria só lista entries públicas, mesmo para quem tem sessão", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    state.user = { id: "u1", name: "Ana", email: "ana@example.com" };
    state.category = blog;
    state.listed = [
      { id: "a", title: "Aberto", slug: "aberto", visibility: "public", publishedAt, updatedAt, mediaId: null, data: {} },
      { id: "b", title: "Fechado", slug: "fechado", visibility: "authenticated", publishedAt, updatedAt, mediaId: null, data: {} },
    ];
    const [ld] = jsonLdOf(await html(CatchAllPage(params(["blog"]))));
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.mainEntity.itemListElement).toEqual([{ "@type": "ListItem", position: 1, name: "Aberto", url: "https://site.test/blog/aberto" }]);
  });
});

describe("JSON-LD de template", () => {
  it("escapa </script> do título — o texto nunca fecha a tag", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    const title = '</script><script>alert("x")</script>';
    state.entry = { id: "e1", title, slug: "post", visibility: "public", publishedAt, updatedAt, mediaId: "m1", data: {} };
    const markup = await html(CatchAllPage(params(["post"])));
    const scripts = markup.match(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).not.toContain("<script>alert");
    expect(scripts[0]).toContain("\\u003c/script\\u003e");
    expect(scripts[0]).toContain('nonce="n0nce"');
    const [ld] = jsonLdOf(markup);
    expect(ld).toMatchObject({
      "@type": "Article",
      headline: title,
      url: "https://site.test/post",
      datePublished: publishedAt.toISOString(),
      dateModified: updatedAt.toISOString(),
      image: ["https://site.test/media/m1.jpg"],
    });
  });

  it("tipo vem de seo.structuredData do tema", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    state.theme = { ...state.theme, seo: { structuredData: { entry: "BlogPosting" } } };
    state.category = blog;
    state.entry = { id: "e1", title: "Post", slug: "post", visibility: "public", publishedAt, updatedAt, mediaId: null, data: {} };
    const [ld] = jsonLdOf(await html(CatchAllPage(params(["blog", "post"]))));
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.url).toBe("https://site.test/blog/post");
  });
});

describe("home", () => {
  it("roda UMA consulta de entry (composição vem do data) e emite WebSite", async () => {
    const { default: HomePage } = await import("./page");
    state.homeEntry = { id: "h", title: "Home", slug: "home", visibility: "public", data: { composition: [{ id: "b1" }] } };
    const markup = await html(HomePage());
    expect(state.calls).toEqual({ publishedBySlug: 1, composition: 0 });
    expect(markup).toContain("1 blocos");
    expect(jsonLdOf(markup)[0]).toEqual({ "@context": "https://schema.org", "@type": "WebSite", name: "Venore Docks", url: "https://site.test/" });
  });

  it("home authenticated para visitante cai no painel", async () => {
    const { default: HomePage } = await import("./page");
    state.homeEntry = { id: "h", title: "Home secreta", slug: "home", visibility: "authenticated", data: {} };
    const markup = await html(HomePage());
    expect(markup).not.toContain("Home secreta");
    expect(markup).toContain("Nenhum conteúdo publicado ainda");
  });
});

describe("variantes de template", () => {
  function withEntryVariants() {
    const Variant = (name: string) =>
      function VariantTemplate({ entry }: EntryTemplateProps) {
        return <p data-variant={name}>{entry.title}</p>;
      };
    state.theme = {
      ...state.theme,
      templates: { ...state.theme.templates, entry: { ...state.theme.templates.entry, hero: Variant("hero"), wide: Variant("wide") } },
    };
  }
  const entry = (data: Record<string, unknown>) => ({ id: "e1", title: "Post", slug: "post", visibility: "public", publishedAt, updatedAt, mediaId: null, data });

  it("da entry (data.layout.template)", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    withEntryVariants();
    state.entry = entry({ layout: { template: "hero" } });
    expect(await html(CatchAllPage(params(["post"])))).toContain('data-variant="hero"');
  });

  it("da seção quando a entry não escolhe; a entry vence a seção", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    withEntryVariants();
    state.section = { id: "s1", pathPrefix: "/", templates: { entry: "wide" } } as ThemeSectionOverride;
    state.entry = entry({});
    expect(await html(CatchAllPage(params(["post"])))).toContain('data-variant="wide"');
    state.entry = entry({ layout: { template: "hero" } });
    expect(await html(CatchAllPage(params(["post"])))).toContain('data-variant="hero"');
  });

  it("variante desconhecida cai no default (kit)", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    withEntryVariants();
    state.entry = entry({ layout: { template: "nao-existe" } });
    const markup = await html(CatchAllPage(params(["post"])));
    expect(markup).not.toContain("data-variant");
    expect(markup).toContain('<article class="space-y-6">');
  });
});

describe("404 e estados", () => {
  it("not-found do (platform) usa o template notFound do tema (renderizado dentro da Shell)", async () => {
    const { default: PlatformNotFound } = await import("./not-found");
    const markup = await html(PlatformNotFound());
    expect(markup).toContain("Página não encontrada");
    expect(markup).toContain('href="/"');
    state.theme = {
      ...state.theme,
      templates: { ...state.theme.templates, notFound: { default: () => <p>404 do tema</p> } },
    };
    expect(await html(PlatformNotFound())).toBe("<p>404 do tema</p>");
  });

  it("/unauthorized é o estado forbidden (mesma moldura de antes)", async () => {
    const { default: UnauthorizedPage } = await import("./unauthorized/page");
    expect(await html(UnauthorizedPage())).toBe(
      '<div class="mx-auto max-w-md space-y-4 rounded-panel border border-border bg-card p-8 text-center shadow-panel"><h1 class="text-lg font-semibold text-foreground">Acesso não autorizado</h1><p class="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p><a class="text-sm text-primary underline" href="/login">Ir para o login</a></div>',
    );
  });

  it("manutenção: o <head> das páginas do CMS sai sem conteúdo e com noindex", async () => {
    const { generateMetadata } = await import("./[...slug]/page");
    state.entry = { id: "e1", title: "Post", slug: "post", visibility: "public", publishedAt, updatedAt, mediaId: null, data: {} };
    state.maintenance = true;
    expect(await generateMetadata(params(["post"]))).toEqual({ robots: { index: false, follow: false } });
    state.maintenance = false;
    const metadata = await generateMetadata(params(["post"]));
    expect(metadata.title).toBe("Post");
    // Sem capa: a imagem padrão de Open Graph (config → asset do tema).
    expect(metadata.openGraph?.images).toEqual([{ url: "https://site.test/og.png" }]);
  });
});
