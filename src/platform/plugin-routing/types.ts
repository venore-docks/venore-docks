import type { Metadata } from "next";
import type { ReactNode } from "react";

export type PluginRouteParams = Record<string, string>;
export type PluginSearchParams = Record<string, string | string[] | undefined>;

// Assinatura idêntica ao `default export` de um page.tsx do Next.js (params + searchParams,
// ambos Promise) — o componente já existente em src/plugins/<nome>/routes/**/page.tsx é usado
// direto aqui, sem wrapper. searchParams é sempre repassado, mesmo pra página que não declara a
// prop (excesso de prop não declarada é inofensivo em JSX).
export type PluginPageComponent = (props: {
  params: Promise<PluginRouteParams>;
  searchParams: Promise<PluginSearchParams>;
}) => ReactNode | Promise<ReactNode>;

// Assinatura idêntica ao `generateMetadata` de um page.tsx do Next.js — title, description, Open
// Graph (imagem de compartilhamento no WhatsApp/redes)... O que não vier aqui continua herdando do
// layout raiz (nome do site, favicon), igual a qualquer página.
export type PluginMetadataGenerator = (props: {
  params: Promise<PluginRouteParams>;
  searchParams: Promise<PluginSearchParams>;
}) => Metadata | Promise<Metadata>;

export type PluginPageRouteEntry = {
  // "" = raiz do plugin (ex: /admin/academy); "courses/:id/enrolled/:studentActorId" = segmento
  // literal ou :param — mesmo vocabulário de path-to-regexp/Express, um único : por segmento.
  pattern: string;
  Component: PluginPageComponent;
  // Opcional, hoje só lido na área "public" (generateMetadata do catch-all do CMS,
  // src/app/(platform)/[...slug]/page.tsx) — é a única área em que <head> de página serve pra
  // alguém de fora (buscador, preview de link). Recebe os mesmos params/searchParams do Component.
  generateMetadata?: PluginMetadataGenerator;
};

export type PluginApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// Assinatura idêntica a um handler nomeado (GET/POST/...) de route.ts.
export type PluginApiHandler = (
  request: Request,
  context: { params: Promise<PluginRouteParams> },
) => Response | Promise<Response>;

export type PluginApiRouteEntry = {
  pattern: string;
  handlers: Partial<Record<PluginApiMethod, PluginApiHandler>>;
};

// Tabela de rotas de um plugin — cada área é independente e opcional (nem todo plugin tem todas).
// "admin" e "public" são casadas por src/app/(platform)/admin/[plugin]/[[...slug]]/page.tsx e pelo
// catch-all do CMS respectivamente; "api" por src/app/api/[plugin]/[[...slug]]/route.ts.
//
// "standalone" = página pública que precisa escapar POR COMPLETO da shell do (platform) (sem
// header/nav/footer — ex: saída de TV, quiosque anônimo, telão). Não pode passar pelo catch-all
// do CMS porque herdar (platform)/layout.tsx é automático ali. Vive sob o prefixo genérico ÚNICO
// /ext/ — o core não tem pasta com nome de plugin. O pattern é o caminho DEPOIS de /ext/, no
// mesmo vocabulário de "public" (ex: "broadcast/out/:token" → URL /ext/broadcast/out/:token).
// Casada pelo dispatcher único src/app/ext/[...slug]/page.tsx via resolveStandalonePluginRoute.
//
// "sidebarContextual" = conteúdo do parallel route @sidebarContextual (coluna contextual do
// layout). Padrão de caminho completo (ex: "academy/:courseSlug/:lessonId"). Casada pelo
// dispatcher único em src/app/(platform)/@sidebarContextual/[[...slug]]/page.tsx, via
// resolveSidebarContextualPluginRoute.
export type PluginRouteTable = {
  admin?: PluginPageRouteEntry[];
  public?: PluginPageRouteEntry[];
  api?: PluginApiRouteEntry[];
  standalone?: PluginPageRouteEntry[];
  sidebarContextual?: PluginPageRouteEntry[];
};

// Cada page.tsx/route.ts real declara seu próprio shape de `params` (ex: `{ id: string }`,
// `{ courseSlug: string; lessonId: string }`) — mais específico que PluginRouteParams
// (Record<string,string>), o que o TypeScript recusa aceitar por variância de parâmetro de função
// (contravariante em tipo de função "solto", ver o erro que motivou isto). Quem monta a
// route-table já garante manualmente que o :param do pattern bate com o nome que o componente
// espera (é a própria tabela, escrita à mão, que faz esse pareamento) — o cast aqui só declara
// essa garantia pro compilador, não abre mão de nenhuma checagem em quem CONSOME
// PluginPageComponent/PluginApiHandler (os resolvers e as rotas de app/ continuam totalmente
// tipados).
export function asPluginPage<TParams extends PluginRouteParams>(
  component: (props: { params: Promise<TParams>; searchParams: Promise<PluginSearchParams> }) => ReactNode | Promise<ReactNode>,
): PluginPageComponent {
  return component as unknown as PluginPageComponent;
}

// Mesmo motivo de asPluginPage (variância do `params` específico da rota) — pro generateMetadata
// opcional de uma entrada de page.
export function asPluginMetadata<TParams extends PluginRouteParams>(
  generator: (props: { params: Promise<TParams>; searchParams: Promise<PluginSearchParams> }) => Metadata | Promise<Metadata>,
): PluginMetadataGenerator {
  return generator as unknown as PluginMetadataGenerator;
}

export function asPluginApiHandler<TParams extends PluginRouteParams>(
  handler: (request: Request, context: { params: Promise<TParams> }) => Response | Promise<Response>,
): PluginApiHandler {
  return handler as unknown as PluginApiHandler;
}
