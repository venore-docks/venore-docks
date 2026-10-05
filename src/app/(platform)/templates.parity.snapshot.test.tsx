import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Snapshot de paridade do markup das páginas que a v8 transforma em templates de tema (spec v8
// §12, Fase F passo 0): entry e categoria do catch-all do CMS, home, conta e login. Gravado antes
// de qualquer mudança; o W4 (templates do kit) precisa reproduzir estes arquivos byte a byte (após
// o mesmo normalizador do Shell). Dado vem de mocks dos barrels — só o markup importa aqui.

const state = vi.hoisted(() => ({
  user: null as null | { id: string; name: string | null; email: string; authProvider: string; avatarMediaId: string | null },
  homeEntry: null as null | Record<string, unknown>,
  homeComposition: null as null | unknown[],
  category: null as null | { id: string; name: string; slug: string; description: string | null },
  entry: null as null | Record<string, unknown>,
  listed: [] as Record<string, unknown>[],
  adminGranted: false,
  activePlugins: new Set<string>(),
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

// As páginas resolvem o tema do request (resolveTemplateContext → resolveDocumentModel). Aqui:
// venore-slime pelo resolvedor puro de verdade, com locale pt-BR — o kit é o que está sob teste.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "n0nce" }) }));
vi.mock("@/platform/seo/site-origin", () => ({ getSiteOrigin: async () => "https://site.test" }));
vi.mock("@/platform/theme-rendering/resolve-maintenance", () => ({
  resolveMaintenance: async () => false,
  readMaintenanceSetting: async () => ({ enabled: false, message: "" }),
}));
vi.mock("@/platform/theme-rendering/document-model", async () => {
  const { resolveThemeDefinition } = await import("@/platform/theme-rendering/resolve-theme-definition");
  const { defaultThemeConfigDocument } = await import("@/contexts/themes/contracts/v8");
  const theme = resolveThemeDefinition("venore-slime").theme;
  return {
    resolveDocumentModel: async () => ({
      pathname: "/",
      area: "public",
      theme,
      config: { ...defaultThemeConfigDocument("venore-slime"), revisionId: null, publishedAt: null, source: "legacy-synthesis" },
      section: null,
      options: { values: {}, ignored: [] },
      fonts: { classNames: "", css: "" },
      locale: "pt-BR",
      dir: "ltr",
      htmlAttributes: {},
      runtimeCss: "",
      override: null,
      diagnostics: { source: "legacy-synthesis", fallback: null, ignoredOptions: [], section: null },
    }),
  };
});

// Marcador do layout da página (async, lê o document-model): aqui só a posição dele no markup.
vi.mock("@/platform/page-builder/page-layout-marker", () => ({ PageLayoutMarker: () => <span hidden data-page-layout="" /> }));
vi.mock("@/contexts/cms", () => ({
  extractEntryComposition: (data: { composition?: unknown[] } | null) => data?.composition ?? null,
  getEntryBody: (data: { body?: string } | null) => data?.body ?? "",
  getCachedCategoryBySlug: async (slug: string) => ({
    success: true,
    data: state.category && state.category.slug === slug ? state.category : null,
  }),
  // A home ("/") lê a entry reservada pelo mesmo getter cache() do catch-all.
  getCachedPublishedEntryBySlug: async (categoryId: string | null, slug: string) => ({
    success: true,
    data: categoryId === null && slug === "home" ? state.homeEntry : state.entry,
  }),
  getEntryComposition: async () => ({ success: true, data: state.homeComposition }),
  listEntries: async () => ({ success: true, data: state.listed }),
  recordEntryView: () => {},
}));

vi.mock("@/contexts/auth", () => ({
  getCurrentUser: async () => ({ success: true, data: state.user }),
  getOwnMfaStatus: async () => ({ success: true, data: { enabled: false, recoveryCodesLeft: 0 } }),
  getOwnAccountData: async () => ({ success: true, data: { hasPassword: true } }),
  isPasswordResetAvailable: () => true,
  listAvailableAuthProviders: () => [
    { key: "google", label: "Google", kind: "oauth", enabled: true },
    { key: "password", label: "Senha", kind: "password", enabled: true },
  ],
}));

vi.mock("@/contexts/media", () => ({
  getMediaAssetUrls: async ({ ids }: { ids: string[] }) => ({
    success: true,
    data: Object.fromEntries(ids.map((id) => [id, `/media/${id}.jpg`])),
  }),
  getMediaAsset: async () => ({ success: true, data: null }),
}));

vi.mock("@/contexts/rbac", () => ({ superadminExists: async () => ({ success: true, data: true }) }));
vi.mock("@/platform/registration/registration-settings", () => ({ isSelfRegistrationEnabled: async () => true }));
vi.mock("@/platform/theme-rendering/resolve-brand-aesthetics", () => ({
  resolveBrandAesthetics: async () => ({ mode: "svg", size: 100, scrolledSize: 92, position: "left", color: "#1f5d43" }),
}));
// Independente dos @venore/plugin-* instalados no branch: o markup do core/kit não depende deles,
// e o grafo de cada plugin puxaria módulos que os mocks abaixo não cobrem.
vi.mock("@/plugins/registry.generated", () => ({ PLUGIN_REGISTRY: [] }));
vi.mock("@/plugins/contributions.generated", () => ({ PLUGIN_CONTRIBUTIONS: {} }));
vi.mock("@/plugins/route-registry.generated", () => ({ PLUGIN_ROUTE_TABLES: {} }));
vi.mock("@/plugins/plugin-barrels.generated", () => ({ PLUGIN_BARRELS: {} }));
vi.mock("@/platform/brand/get-brand-config", () => ({
  getBrandConfig: async () => ({ siteName: "Venore Docks", logoUrl: "/brand/brand-logo.svg" }),
}));
vi.mock("@/platform/plugin-routing/resolve-public-route", () => ({
  resolvePublicPluginRoute: async () => ({ kind: "not-a-plugin-route" }),
}));
vi.mock("@/platform/admin-shell/get-admin-page-data", () => ({
  getAdminPageData: async () => ({ granted: state.adminGranted }),
}));
vi.mock("@/platform/plugin-engine/get-active-plugin-keys", () => ({
  getActivePluginKeys: async () => state.activePlugins,
}));
vi.mock("@/plugins/contributions", () => ({ PLUGIN_CONTRIBUTIONS: {} }));
vi.mock("@/components/page-builder/block-renderer", () => ({
  BlockRenderer: ({ blocks, mode }: { blocks: unknown[]; mode: string }) => (
    <div data-test-block-renderer={mode}>{blocks.length} blocos</div>
  ),
}));
vi.mock("@/app/(auth)/actions", () => ({
  signInWithPasswordAction: async () => {},
  signInWithProviderAction: async () => {},
  signUpWithPasswordAction: async () => {},
}));
vi.mock("@/app/(platform)/account/actions", () => ({
  changeOwnPasswordAction: async () => ({}),
  revokeOtherSessionsAction: async () => ({}),
  deleteOwnAccountAction: async () => ({}),
  updateOwnAvatarAction: async () => ({}),
  uploadAvatarAction: async () => ({}),
  updateOwnNameAction: async () => ({}),
  startMfaEnrollmentAction: async () => ({}),
  confirmMfaEnrollmentAction: async () => ({}),
  disableMfaAction: async () => ({}),
}));

// Páginas são server components async e podem devolver outro componente async (CoursesHome da
// home). renderToStaticMarkup não aguarda promessas — resolve só as funções async antes.
async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveAsync));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
    const rendered = await (element.type as (props: unknown) => Promise<ReactNode>)(element.props);
    return resolveAsync(rendered);
  }
  if (element.props && "children" in element.props) {
    const children = await resolveAsync(element.props.children);
    return { ...element, props: { ...element.props, children } } as ReactElement;
  }
  return element;
}

// JSON-LD de template (spec v8 §7.7) é acréscimo da v8, coberto em templates.seo.test.tsx — o
// snapshot de paridade compara só o markup visível de antes.
async function render(page: Promise<ReactNode>): Promise<string> {
  return renderToStaticMarkup(<>{await resolveAsync(await page)}</>)
    .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/ data-(?:region|outlet|block[a-z-]*)(?:="[^"]*")?/g, "");
}

const publishedAt = new Date("2026-03-15T12:00:00Z");
const blogCategory = { id: "cat-1", name: "Blog", slug: "blog", description: "Notícias & novidades" };
const richComposition = [
  { id: "b1", key: "core.content.richtext", data: { content: { type: "doc", content: [{ type: "text", text: "Resumo do post." }] } } },
];

beforeEach(() => {
  state.user = null;
  state.homeEntry = null;
  state.homeComposition = null;
  state.category = null;
  state.entry = null;
  state.listed = [];
  state.adminGranted = false;
  state.activePlugins = new Set();
});

const params = (slug: string[]) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });

describe("templates — paridade do markup de hoje", () => {
  it("entry com composição (categoria/slug)", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    state.category = blogCategory;
    state.entry = { id: "e1", title: "Olá <mundo>", slug: "ola", visibility: "public", publishedAt, mediaId: null, data: { composition: richComposition } };
    await expect(await render(CatchAllPage(params(["blog", "ola"])))).toMatchFileSnapshot("./__parity__/entry-composition.html");
  });

  it("entry raiz sem composição", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    state.entry = { id: "e2", title: "Sobre", slug: "sobre", visibility: "public", publishedAt: null, mediaId: null, data: { body: "Texto simples." } };
    await expect(await render(CatchAllPage(params(["sobre"])))).toMatchFileSnapshot("./__parity__/entry-root-body.html");
  });

  it("categoria com cards e próxima página", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    state.category = blogCategory;
    state.listed = Array.from({ length: 13 }, (_, i) => ({
      id: `e${i}`,
      title: `Post ${i}`,
      slug: `post-${i}`,
      visibility: "public",
      publishedAt,
      mediaId: i % 2 === 0 ? `m${i}` : null,
      data: { composition: richComposition },
    }));
    await expect(await render(CatchAllPage(params(["blog"])))).toMatchFileSnapshot("./__parity__/category-cards.html");
  });

  it("categoria vazia", async () => {
    const { default: CatchAllPage } = await import("./[...slug]/page");
    state.category = { ...blogCategory, description: null };
    await expect(await render(CatchAllPage(params(["blog"])))).toMatchFileSnapshot("./__parity__/category-empty.html");
  });

  it("home com entry composta", async () => {
    const { default: HomePage } = await import("./page");
    // Uma consulta só (spec v8 §12 W4): a composição vem do `data` da entry publicada.
    state.homeEntry = { id: "h", title: "Home", slug: "home", visibility: "public", data: { composition: richComposition } };
    state.homeComposition = richComposition;
    await expect(await render(HomePage())).toMatchFileSnapshot("./__parity__/home-entry.html");
  });

  it("home sem entry (painel) para admin", async () => {
    const { default: HomePage } = await import("./page");
    state.adminGranted = true;
    state.activePlugins = new Set(["academy"]);
    await expect(await render(HomePage())).toMatchFileSnapshot("./__parity__/home-panel-admin.html");
  });

  it("conta", async () => {
    const { default: AccountPage } = await import("./account/page");
    state.user = { id: "u1", name: "Ana Lima", email: "ana@example.com", authProvider: "credentials", avatarMediaId: null };
    await expect(await render(AccountPage({ searchParams: Promise.resolve({ aviso: "senha-alterada" }) }))).toMatchFileSnapshot(
      "./__parity__/account.html",
    );
  });

  it("login", async () => {
    const { default: LoginPage } = await import("../(auth)/login/page");
    await expect(
      await render(LoginPage({ searchParams: Promise.resolve({ error: "invalid-credentials", callbackUrl: "/account" }) })),
    ).toMatchFileSnapshot("./__parity__/login.html");
  });
});
