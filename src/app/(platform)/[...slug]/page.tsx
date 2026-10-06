import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import {
  extractEntryComposition,
  getCachedCategoryBySlug,
  getCachedPublishedEntryBySlug,
  getEntryBody,
  listEntries,
  recordEntryView,
} from "@/contexts/cms";
import type { EntryRecord } from "@/contexts/cms";
import { getCurrentUser } from "@/contexts/auth";
import { getMediaAssetUrls } from "@/contexts/media";
import { getSpeechAudio } from "@/contexts/speech";
import { SpeechPlayer } from "@/components/speech/speech-player";
import { cmsEntrySpeechScope } from "@/platform/speech/cms-entry-scope";
import { resolvePublicPluginRoute } from "@/platform/plugin-routing/resolve-public-route";
import type { ThemeEntryView } from "@/contexts/themes/contracts/v8";
import { BlockRenderer } from "@/components/page-builder/block-renderer";
import { PageLayoutMarker } from "@/platform/page-builder/page-layout-marker";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import { extractExcerpt } from "@/platform/seo/entry-excerpt";
import { getSiteOrigin } from "@/platform/seo/site-origin";
import { resolveDefaultOgImage } from "@/platform/seo/og-image";
import { renderState } from "@/platform/theme-rendering/render-state";
import {
  renderTemplate,
  resolvePageOutlets,
  resolveTemplateContext,
  resolveTemplateVariant,
  toOutletUser,
} from "@/platform/theme-rendering/render-template";
import { resolveMaintenance } from "@/platform/theme-rendering/resolve-maintenance";
import { buildTemplateJsonLd } from "@/platform/theme-rendering/template-json-ld";
import { CoreJsonLd } from "@/theme-sdk/kit/json-ld";

// force-dynamic: mesmo motivo de app/page.tsx — conteúdo e tema ativo mudam em runtime.
export const dynamic = "force-dynamic";

type CatchAllProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// generateMetadata e a página resolvem a MESMA rota de plugin no mesmo request — cache() evita
// ler o registro de plugins ativos (registerPlugins, sem cache próprio) duas vezes. Chave em JSON
// (não join("/")) porque um segmento decodificado pode conter "/".
const resolvePublicPluginRouteForRequest = cache((segmentsKey: string) => resolvePublicPluginRoute(JSON.parse(segmentsKey) as string[]));

// Só rota de plugin com generateMetadata na route-table (ex: página pública de um jogo do
// erasto-league, com a capa como imagem de compartilhamento) sobrescreve algo aqui — o resto
// continua herdando o metadata do layout raiz, como antes. Erro no metadata de um plugin não
// derruba a página: cai pro metadata herdado (a própria página decide se renderiza ou falha);
// notFound()/redirect() internos do Next continuam valendo (unstable_rethrow).
export async function generateMetadata({ params, searchParams }: CatchAllProps): Promise<Metadata> {
  const { slug: segments } = await params;
  const pluginRoute = await resolvePublicPluginRouteForRequest(JSON.stringify(segments));
  if (pluginRoute.kind === "not-a-plugin-route") {
    return generateCmsMetadata(segments);
  }
  if (pluginRoute.kind !== "matched" || !pluginRoute.generateMetadata) {
    return {};
  }
  try {
    return await pluginRoute.generateMetadata({ params: Promise.resolve(pluginRoute.params), searchParams });
  } catch (error) {
    unstable_rethrow(error);
    console.warn(`[plugin-routing] generateMetadata de "/${segments.join("/")}" falhou — usando o metadata herdado.`, error);
    return {};
  }
}

const isViewerAuthenticated = cache(async (): Promise<boolean> => {
  const currentUser = await getCurrentUser();
  return currentUser.success && Boolean(currentUser.data);
});

// <head> das páginas do CMS: título, resumo (primeiro rich text), capa como og:image, canonical.
// Conteúdo "authenticated" sai com noindex — mesmo pra quem está logado vendo a página.
async function generateCmsMetadata(segments: string[]): Promise<Metadata> {
  if (segments.length === 0 || segments.length > 2) return {};
  // Manutenção (spec v8 §7.9): quem não é admin vê só o aviso — nada do conteúdo vai pro <head>.
  if (await resolveMaintenance(await getAdminPageData())) return { robots: { index: false, follow: false } };

  const categoryResult = await getCachedCategoryBySlug(segments[0]);
  const category = categoryResult.success ? categoryResult.data : null;
  if (segments.length === 1 && category) {
    return {
      title: category.name,
      description: category.description ?? undefined,
      alternates: { canonical: `/${category.slug}`, types: { "application/rss+xml": `/rss.xml?category=${category.slug}` } },
    };
  }

  const entryResult =
    segments.length === 1
      ? await getCachedPublishedEntryBySlug(null, segments[0])
      : category
        ? await getCachedPublishedEntryBySlug(category.id, segments[1])
        : null;
  const entry = entryResult?.success ? entryResult.data : null;
  if (!entry) return {};
  // Título/resumo de conteúdo fechado não vai pro <head> de quem não pode ver a página.
  if (!(await isVisibleToCurrentViewer(entry))) return {};

  const description = extractExcerpt(extractEntryComposition(entry.data), 200) ?? undefined;
  const coverResult = entry.mediaId ? await getMediaAssetUrls({ ids: [entry.mediaId] }) : null;
  const coverUrl = entry.mediaId && coverResult?.success ? coverResult.data[entry.mediaId] : undefined;
  const path = category && segments.length === 2 ? `/${category.slug}/${entry.slug}` : `/${entry.slug}`;

  return {
    title: entry.title,
    description,
    alternates: { canonical: path },
    robots: entry.visibility === "public" ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: entry.title,
      description,
      url: path,
      publishedTime: entry.publishedAt?.toISOString(),
      // Sem capa: a imagem padrão de compartilhamento (config do tema → asset do tema), spec §7.7.
      images: coverUrl ? [{ url: coverUrl }] : await resolveDefaultOgImage(),
    },
  };
}

// C7: "authenticated" nunca aparece pra visitante sem sessão — nem como entry única (notFound),
// nem como item de listagem (BL1: filtrado antes de renderizar, não link que ia dar 404).
async function isVisibleToCurrentViewer(entry: EntryRecord): Promise<boolean> {
  if (entry.visibility === "public") return true;
  return isViewerAuthenticated();
}

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

// Variante "hero" do template de entry: a composição abre com um bloco hero (o tema pode, por
// exemplo, esconder o título duplicado).
const HERO_BLOCK_KEY = "core.content.hero";

// BL1 (docs/implementation-roadmap.md, Fase 4): rota de categoria em formato blog — lista as
// entries publicadas daquela categoria, respeitando status (listEntries já filtra
// status="published") e visibilidade por entry (C7). Capa do card vem de entry.mediaId (campo
// dedicado de "imagem de destaque", exposto no form de edição da entry via MediaPickerField) —
// não da composição, pra não depender de onde o autor colocou a imagem dentro do corpo.
const BLOGROLL_PAGE_SIZE = 12;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

// Uma consulta de entries (a página pedida + 1, pra saber se há próxima), uma de mídia pra todas
// as capas, e o resumo vem do `data` que a listagem já trouxe. O desenho é o template "category"
// do tema (spec v8 §2.7); o dado continua resolvido aqui.
async function renderCategoryBlogroll(category: { id: string; name: string; slug: string; description: string | null }, page: number) {
  const [viewerIsAuthenticated, context] = await Promise.all([isViewerAuthenticated(), resolveTemplateContext()]);
  const entriesResult = await listEntries({
    categoryId: category.id,
    // C7: visitante sem sessão só vê "public" — filtrado no banco, antes da paginação.
    ...(viewerIsAuthenticated ? {} : { visibility: "public" as const }),
    limit: BLOGROLL_PAGE_SIZE + 1,
    offset: (page - 1) * BLOGROLL_PAGE_SIZE,
  });
  const fetched = entriesResult.success ? entriesResult.data : [];
  const hasNextPage = fetched.length > BLOGROLL_PAGE_SIZE;
  const pageEntries = fetched.slice(0, BLOGROLL_PAGE_SIZE);

  const coverIds = pageEntries.map((entry) => entry.mediaId).filter((id): id is string => Boolean(id));
  const coversResult = await getMediaAssetUrls({ ids: coverIds });
  const coverUrls = coversResult.success ? coversResult.data : {};

  const categoryPath = `/${category.slug}`;
  const entries: ThemeEntryView[] = pageEntries.map((entry) => {
    const coverUrl = entry.mediaId ? (coverUrls[entry.mediaId] ?? null) : null;
    return {
      id: entry.id,
      title: entry.title,
      excerpt: extractExcerpt(extractEntryComposition(entry.data)),
      path: `${categoryPath}/${entry.slug}`,
      publishedAt: toIso(entry.publishedAt),
      updatedAt: toIso(entry.updatedAt),
      category: { label: category.name, href: categoryPath },
      cover: coverUrl ? { url: coverUrl, alt: "" } : null,
    };
  });

  // JSON-LD só lista o que é público — mesmo para quem tem sessão e vê itens "authenticated" (C7).
  const origin = await getSiteOrigin();
  const publicItems = pageEntries
    .map((entry, index) => ({ entry, view: entries[index] }))
    .filter(({ entry }) => entry.visibility === "public")
    .map(({ view }) => ({ title: view.title, url: `${origin}${view.path}` }));
  const jsonLd = buildTemplateJsonLd(context.theme, {
    kind: "category",
    name: category.name,
    url: `${origin}${categoryPath}`,
    description: category.description,
    items: publicItems,
  });

  const empty = renderState(context.theme, "empty", {
    ...context.common,
    title: "Nenhum conteúdo publicado nesta categoria ainda",
    message: "Volte mais tarde — novos textos aparecem aqui assim que forem publicados.",
    action: null,
  });

  return renderTemplate(
    context.theme,
    "category",
    {
      ...context.common,
      category: {
        label: category.name,
        description: category.description,
        path: categoryPath,
        rssPath: `/rss.xml?category=${category.slug}`,
      },
      entries,
      pagination: {
        page,
        pageCount: hasNextPage ? page + 1 : page,
        prevHref: page > 1 ? (page === 2 ? categoryPath : `${categoryPath}?page=${page - 1}`) : null,
        nextHref: hasNextPage ? `${categoryPath}?page=${page + 1}` : null,
      },
      sort: { current: "recent", options: [] },
      empty,
      jsonLd: <CoreJsonLd data={jsonLd} nonce={context.nonce} />,
      outlets: { before: null, after: null },
    },
    { variant: resolveTemplateVariant("category", { section: context.section }) },
  );
}

export default async function CatchAllPage({ params, searchParams }: CatchAllProps) {
  const { slug: segments } = await params;

  // Rota de plugin (ex: /academy, /birthdays, /donations) sempre tem precedência sobre conteúdo
  // do CMS de mesmo slug — mesmo comportamento de quando cada uma era uma pasta literal em
  // app/(platform)/**, reservando o slug antes do catch-all existir sequer. Plugin registrado mas
  // desativado, ou sub-rota que não casou, vira notFound() direto — nunca cai pra procurar
  // conteúdo do CMS com aquele slug (ver comentário em resolve-public-route.ts).
  const pluginRoute = await resolvePublicPluginRouteForRequest(JSON.stringify(segments));
  if (pluginRoute.kind === "reserved-not-found") {
    notFound();
  }
  if (pluginRoute.kind === "matched") {
    const { Component, params: routeParams } = pluginRoute;
    return <Component params={Promise.resolve(routeParams)} searchParams={searchParams} />;
  }

  // "home" só existe canonicamente em "/" — sem isso, /home renderizaria o mesmo conteúdo da
  // home num segundo endereço (docs/venore-docks.md — decisão de rota pública desta sessão).
  if (segments.length === 1 && segments[0] === "home") {
    notFound();
  }

  let entryResult;
  let backHref = "/";
  let backLabel = "Início";
  let entryCategory: ThemeEntryView["category"] = null;

  if (segments.length === 1) {
    // BL1: categoria tem precedência sobre uma entry raiz de mesmo slug — decisão registrada
    // (docs/implementation-roadmap.md, Fase 4/BL1): o banco não impede as duas existirem com o
    // mesmo slug (índices únicos independentes, ver database/schema/index.ts), então uma ordem
    // determinística era necessária. Categoria só existe pra ser uma seção navegável; uma entry
    // raiz de mesmo slug (caso raro) fica inalcançável por este endereço enquanto a categoria
    // existir.
    const categoryResult = await getCachedCategoryBySlug(segments[0]);
    if (categoryResult.success && categoryResult.data) {
      return renderCategoryBlogroll(categoryResult.data, parsePage((await searchParams).page));
    }

    entryResult = await getCachedPublishedEntryBySlug(null, segments[0]);
  } else if (segments.length === 2) {
    const categoryResult = await getCachedCategoryBySlug(segments[0]);
    if (!categoryResult.success || !categoryResult.data) {
      notFound();
    }
    entryResult = await getCachedPublishedEntryBySlug(categoryResult.data.id, segments[1]);
    backHref = `/${categoryResult.data.slug}`;
    backLabel = categoryResult.data.name;
    entryCategory = { label: categoryResult.data.name, href: backHref };
  } else {
    notFound();
  }

  if (!entryResult.success || !entryResult.data) {
    notFound();
  }

  const entry = entryResult.data;

  // Privacidade por conteúdo (Fase 2/C7): "authenticated" nunca renderiza pra visitante sem
  // sessão — notFound() em vez de redirect pro login, pra não confirmar que existe conteúdo
  // fechado nesse endereço a quem não tem acesso.
  if (!(await isVisibleToCurrentViewer(entry))) {
    notFound();
  }

  recordEntryView(entry.id);

  // Áudio só existe para entry pública (o MP3 é público — ver platform/speech).
  const speechScope = cmsEntrySpeechScope(entry.id);
  const [context, currentUser, adminGate, origin, speech] = await Promise.all([
    resolveTemplateContext(),
    getCurrentUser(),
    getAdminPageData(),
    getSiteOrigin(),
    entry.visibility === "public" ? getSpeechAudio({ scopes: [speechScope] }) : null,
  ]);
  const speechUrl = speech?.success ? (speech.data[speechScope]?.[0]?.url ?? null) : null;
  const user = currentUser.success && currentUser.data ? currentUser.data : null;
  const outlets = await resolvePageOutlets(context, {
    user: toOutletUser(user),
    canAccessAdmin: adminGate.granted,
  });

  // A entry publicada já veio com `data` — extrair a composição dali evita um segundo SELECT.
  const composition = extractEntryComposition(entry.data);
  const path = entryCategory ? `${entryCategory.href}/${entry.slug}` : `/${entry.slug}`;
  const coverResult = entry.mediaId ? await getMediaAssetUrls({ ids: [entry.mediaId] }) : null;
  const coverUrl = entry.mediaId && coverResult?.success ? (coverResult.data[entry.mediaId] ?? null) : null;
  const view: ThemeEntryView = {
    id: entry.id,
    title: entry.title,
    excerpt: extractExcerpt(composition),
    path,
    publishedAt: toIso(entry.publishedAt),
    updatedAt: toIso(entry.updatedAt),
    category: entryCategory,
    cover: coverUrl ? { url: coverUrl, alt: "" } : null,
  };

  // C7: só conteúdo "public" ganha dado estruturado; "authenticated" (visto por quem tem sessão)
  // é noindex e sai sem JSON-LD.
  const jsonLd =
    entry.visibility === "public"
      ? buildTemplateJsonLd(context.theme, {
          kind: "entry",
          title: entry.title,
          url: `${origin}${path}`,
          publishedAt: view.publishedAt,
          updatedAt: view.updatedAt,
          image: coverUrl ? new URL(coverUrl, origin).toString() : null,
          description: view.excerpt,
          siteName: null,
        })
      : null;

  return renderTemplate(
    context.theme,
    "entry",
    {
      ...context.common,
      entry: view,
      content: composition ? (
        <BlockRenderer blocks={composition} mode="published" />
      ) : (
        <>
          {/* Sem composição não há BlockRenderer: o marcador do layout da página sai daqui. */}
          <PageLayoutMarker />
          <p className="text-muted-foreground">{getEntryBody(entry.data)}</p>
        </>
      ),
      backLink: { href: backHref, label: backLabel },
      firstBlockIsHero: composition?.[0]?.key === HERO_BLOCK_KEY,
      jsonLd: <CoreJsonLd data={jsonLd} nonce={context.nonce} />,
      outlets: {
        before: speechUrl ? <SpeechPlayer src={speechUrl} /> : null,
        after: outlets["entry.after-content"] ?? null,
      },
    },
    { variant: resolveTemplateVariant("entry", { section: context.section, entryData: entry.data }) },
  );
}
