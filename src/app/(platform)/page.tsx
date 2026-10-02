import { extractEntryComposition, getEntryBody, getPublishedEntryBySlug, recordEntryView } from "@/contexts/cms";
import { getCurrentUser } from "@/contexts/auth";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { getSiteOrigin } from "@/platform/seo/site-origin";
import {
  renderTemplate,
  resolvePageOutlets,
  resolveTemplateContext,
  resolveTemplateVariant,
  toOutletUser,
} from "@/platform/theme-rendering/render-template";
import { buildTemplateJsonLd } from "@/platform/theme-rendering/template-json-ld";
import { BlockRenderer } from "@/components/page-builder/block-renderer";
import type { HomeTemplateProps } from "@/contexts/themes/contracts/v8";
import { CoreJsonLd } from "@/theme-sdk/kit/json-ld";
import type { KitHomeTemplateExtras } from "@/theme-sdk/kit/templates/simple-templates";

// force-dynamic: conteúdo (CMS) e tema ativo são runtime-configuráveis, sem rebuild
// (docs/venore-docks.md — "Sobre temas").
export const dynamic = "force-dynamic";

// Home é a entry reservada com categoryId null e slug "home".
const HOME_SLUG = "home";

// "/" (spec v8 §2.7): o dado é resolvido aqui, o desenho é o template "home" do tema.
//  - Plataforma aberta (pedido do dono, "site tem que ficar aberto, só o admin precisa de login"):
//    qualquer visitante vê a entry "home" do CMS quando ela existe e é visível pra ele;
//    "authenticated" (C7, mesma regra do catch-all) só aparece pra quem tem sessão.
//  - Sem entry visível: o painel — nome do site, a vitrine de plugin (outlet home.showcase, que
//    já carrega o publicHomeShowcase dos plugins ativos) e os atalhos de admin para quem tem
//    acesso ao painel.
// Uma consulta de entry só: a composição vem do `data` que a entry publicada já trouxe.
export default async function HomePage() {
  const [currentUser, adminGate, context] = await Promise.all([getCurrentUser(), getAdminPageData(), resolveTemplateContext()]);
  const user = currentUser.success && currentUser.data ? currentUser.data : null;

  const result = await getPublishedEntryBySlug({ categoryId: null, slug: HOME_SLUG });
  const entry = result.success && result.data ? result.data : null;
  const canViewEntry = entry != null && (entry.visibility === "public" || user != null);

  const [brand, outlets, origin] = await Promise.all([
    getBrandConfig(),
    resolvePageOutlets(context, {
      user: toOutletUser(user),
      canAccessAdmin: adminGate.granted,
    }),
    getSiteOrigin(),
  ]);
  const jsonLd = buildTemplateJsonLd(context.theme, { kind: "home", siteName: brand.siteName, url: `${origin}/` });
  const common = {
    ...context.common,
    jsonLd: <CoreJsonLd data={jsonLd} nonce={context.nonce} />,
    outlets: { before: null, after: null },
  };

  if (entry && canViewEntry) {
    recordEntryView(entry.id);
    const composition = extractEntryComposition(entry.data);
    return renderTemplate(
      context.theme,
      "home",
      {
        ...common,
        entry: {
          id: entry.id,
          title: entry.title,
          excerpt: null,
          path: "/",
          publishedAt: entry.publishedAt ? entry.publishedAt.toISOString() : null,
          updatedAt: entry.updatedAt ? entry.updatedAt.toISOString() : null,
          category: null,
          cover: null,
        },
        content: composition ? (
          <BlockRenderer blocks={composition} mode="published" />
        ) : (
          <article>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{entry.title}</h1>
            <p className="mt-2 text-muted-foreground">{getEntryBody(entry.data)}</p>
          </article>
        ),
        showcase: null,
        adminShortcuts: [],
      },
      { variant: resolveTemplateVariant("home", { section: context.section, entryData: entry.data }) },
    );
  }

  // "Ver como aluno" só faz sentido em instâncias com a Academy ativa — numa instância sem o
  // plugin, /academy nem existe (resolvePublicPluginRoute devolveria notFound).
  const hasAcademy = (await getActivePluginKeys()).has("academy");
  // siteName/primaryAction/ícone do atalho: extensões que o kit lê e o contrato §2.7 ainda não
  // declara (pedido em /home/user/v8/requests/w4.md) — passadas por variável, sem cast.
  const panel: HomeTemplateProps & KitHomeTemplateExtras = {
    ...common,
    entry: null,
    content: null,
    showcase: outlets["home.showcase"] ?? null,
    siteName: brand.siteName,
    primaryAction: hasAcademy ? { href: "/academy", label: "Ver como aluno" } : null,
    adminShortcuts: adminGate.granted
      ? [
          { href: "/admin", label: "Painel", icon: "settings" as const },
          { href: "/admin/cms/entries/new", label: "Personalizar a home no CMS" },
        ]
      : [],
  };
  return renderTemplate(context.theme, "home", panel, { variant: resolveTemplateVariant("home", { section: context.section }) });
}
