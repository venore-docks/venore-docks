---
paths:
  - "src/plugins/**"
  - "src/platform/plugin-*/**"
  - "src/app/api/**"
  - "src/app/ext/**"
  - "src/app/**/page.tsx"
---
# Rotas de plugin (AGENTS.md §1.1)

1.1 Rotas de plugin: `app/` não conhece nomes de plugin, tudo mora em `src/plugins/<nome>/routes/`

Nenhuma página, `action.ts`, componente local de rota ou route handler de um plugin mora em
`src/app/`, **e nenhuma pasta de `app/` é nomeada por plugin** (nada de `admin/broadcast/`,
`api/birthdays/`, `academy/` — nem como shim). A fronteira de um plugin é só o plugin; `app/` só
sabe que "existe um mecanismo genérico de despacho", nunca "existe o plugin X".

Isso é resolvido por **duas peças por plugin** dentro de `src/plugins/<nome>/routes/`:

1. Os componentes/handlers de verdade (`admin/page.tsx`, `admin-course/page.tsx`,
   `api/course-export/route.ts` etc.) — mesma ideia de sempre, só que agora nunca têm um shim
   correspondente em `app/`.
2. `route-table.ts`, exportando `PluginRouteTable` (`src/platform/plugin-routing/types.ts`): um
   array `{ pattern, Component }`/`{ pattern, handlers }` por área (`admin`, `public`, `api`).
   `pattern` usa `:nome` pra segmento capturado (`"courses/:id/enrolled/:studentActorId"`) — o
   nome do `:param` precisa bater com a prop que o componente espera. `admin`/`api` são
   relativos (sem o nome do plugin, ex: `"messages"`); `public` é **caminho completo** (ex:
   `"academy/:courseSlug"`, `"cursos"`) porque um plugin pode ter mais de um "namespace" de URL
   pública (academy é dono de `academy/**` e também de `cursos`, uma vitrine separada). Os dois
   helpers `asPluginPage`/`asPluginApiHandler` só existem pra contornar variância de parâmetro do
   TypeScript (o componente real tem um `params` mais específico que `PluginRouteParams`); quem
   escreve a `route-table.ts` é responsável por garantir que o `:param` do pattern bate com o que
   o componente espera — não tem checagem automática disso.

`src/plugins/route-registry.ts` agrega a `route-table` de cada plugin instalado (mesmo padrão de
import estático de `src/plugins/registry.ts` pros manifestos). Cinco pontos em `app/` — só esses,
pra sempre, independente de quantos plugins existirem ou quantas rotas cada um ganhar depois —
consultam esse registro (os três abaixo, mais `ext/` e `@sidebarContextual/` nas "exceções
físicas"):

- `src/app/(platform)/admin/[plugin]/page.tsx` e `src/app/(platform)/admin/[plugin]/[...slug]/page.tsx`
  — toda rota admin de plugin.
- `src/app/api/[plugin]/[[...slug]]/route.ts` — toda rota de API de plugin.
- `src/app/(platform)/[...slug]/page.tsx` (o catch-all do CMS) — antes de tentar resolver
  categoria/entry, chama `resolvePublicPluginRoute(segments)`; um caminho que casa com um plugin
  ativo renderiza o plugin, um que casa com um plugin **desativado** vira `notFound()` direto
  (nunca cai pra procurar conteúdo do CMS no mesmo slug — o caminho fica "reservado" pro plugin
  mesmo desligado), e um caminho que não casa com nenhum plugin segue o fluxo normal do CMS. Isso
  é deliberado: o catch-all do CMS é o único dispatcher de rota pública do sistema, plugin incluso
  — não existe mais uma pasta reservando o slug antes dele.

Adicionar uma rota nova a um plugin existente (admin, pública ou API) é só uma entrada nova em
`route-table.ts` — nunca toca `app/`.

`<head>` de rota pública de plugin (title, description, Open Graph — ex: imagem de preview de link
no WhatsApp) também mora na `route-table.ts`: a entrada `public` aceita um `generateMetadata`
opcional, mesma assinatura do `generateMetadata` de um `page.tsx` (envolto em `asPluginMetadata`,
mesmo motivo de `asPluginPage`). Quem chama é o `generateMetadata` do catch-all do CMS; sem ele, a
página herda o metadata do layout raiz como qualquer outra. Imagem de Open Graph precisa de URL
absoluta — o layout raiz não declara `metadataBase`, então o plugin monta a origem a partir do
request.

**Exceções físicas, não de conteúdo** (continuam existindo por exigência do Next.js, não por
preguiça de generalizar):
- Route segment config (`export const dynamic`, `revalidate`, `runtime`) só é lido de export
  direto no arquivo de rota dentro de `app/`, nunca via import — por isso os pontos de
  despacho acima declaram `export const dynamic = "force-dynamic"` (ou equivalente) neles mesmos,
  cobrindo toda rota que passa por ali, em vez de cada plugin precisar declarar o seu.
- Parallel route (`@slotName`, ex: `@sidebarContextual`) exige um arquivo físico no slot — resolvido
  com um dispatcher único, `src/app/(platform)/@sidebarContextual/[...slug]/page.tsx`, que casa a
  URL contra a área `sidebarContextual` das route-tables (`resolveSidebarContextualPluginRoute`).
  Nenhum segmento de plugin fica físico no slot.
- Uma página que precisa escapar por completo da shell do `(platform)` (sem header/nav/footer —
  saída de TV, quiosque, telão) não pode entrar no catch-all do CMS, porque herdar
  `(platform)/layout.tsx` é automático sob esse route group. Toda rota assim mora sob o prefixo
  genérico único `src/app/ext/[...slug]/page.tsx` (`/ext/<caminho>`), casada contra a área
  `standalone` da route-table (`resolveStandalonePluginRoute`) — ex: o `broadcast` declara
  `broadcast/out/:token` e é servido em `/ext/broadcast/out/<token>`.

**Um plugin pode ser dono de uma URL que não começa pelo seu próprio nome** (ex: `academy` é dono
de `/cursos`, não só de `/academy/**`) — a `route-table.ts` "public" registra o caminho completo,
não um prefixo implícito.
