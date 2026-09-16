<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:venore-docks-rules -->
# AGENTS.md — o que eu, agente, posso e não posso fazer hoje

`docs/venore-docks.md` é o documento de arquitetura: responde *por que* o sistema tem essa forma.
Esta seção é o contraponto operacional: responde *o que fazer* ao escrever código aqui, hoje. Onde
os dois divergirem, o código real é a fonte da verdade — e a divergência vira uma entrada em
"Known Gaps" (seção 7), não uma correção silenciosa deste arquivo.

## 1. Fluxo de camadas obrigatório

Todo use case segue esta cadeia, em arquivos separados mesmo quando pequenos
(`src/contexts/<nome>/features/<feature>/<use-case>/`):

```
handler.ts → service.ts → store.ts → view.ts / types.ts
```

| Camada | Pode | NÃO pode |
| --- | --- | --- |
| `handler.ts` | Validar input, chamar `authorizeActor(...)`, chamar **exatamente um** `service` | Acessar banco, conter regra de negócio, chamar `store` diretamente |
| `service.ts` | Toda a regra de negócio, orquestrar `store`, chamar `service` público (via barrel `index.ts`) de **outro** context | Acessar banco diretamente, importar `store`/`service` interno de outro context, depender de UI/framework |
| `store.ts` | Único ponto de acesso a dado do use case | Conter regra de negócio, validar, autorizar |
| `view.ts` | Formatar DTO/presenter de saída | Regra de negócio |
| `types.ts` | Tipos, comandos, resultados, erros | Lógica |

`handler` e `service` sempre retornam este formato — nunca lançam exception para erro de negócio
esperado (email duplicado, sem permissão etc.); exception fica reservada a falha de infra/bug:

```ts
type OperationResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };
```

Exemplo real (`src/contexts/rbac/features/role-assignment/assign-role-to-user/handler.ts`):
valida input → `authorizeActor("rbac.roles.assign")` → chama o `service` (único) → retorna o
`OperationResult` dele direto, sem tocar em `store`.

**Exceções já documentadas e aceitas** (não copiar como padrão para código novo):
- `DrizzleAdapter` do Auth.js escreve direto em `users`/`accounts`/`sessions` sem passar por
  `store.ts` — é como o adapter funciona, não deve ser "corrigido".
- `useTheme()` do `next-themes` é a única exceção a "o tema nunca busca dado sozinho": o
  color-mode toggle (`src/components/color-mode-toggle.tsx`) lê/altera tema direto no client.

### 1.1 Rotas de plugin: `app/` não conhece nomes de plugin, tudo mora em `src/plugins/<nome>/routes/`

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
import estático de `src/plugins/registry.ts` pros manifestos). Três pontos em `app/` — só três, pra
sempre, independente de quantos plugins existirem ou quantas rotas cada um ganhar depois —
consultam esse registro:

- `src/app/(platform)/admin/[plugin]/[[...slug]]/page.tsx` — toda rota admin de plugin.
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

**Exceções físicas, não de conteúdo** (continuam existindo por exigência do Next.js, não por
preguiça de generalizar):
- Route segment config (`export const dynamic`, `revalidate`, `runtime`) só é lido de export
  direto no arquivo de rota dentro de `app/`, nunca via import — por isso os três pontos de
  despacho acima declaram `export const dynamic = "force-dynamic"` (ou equivalente) neles mesmos,
  cobrindo toda rota que passa por ali, em vez de cada plugin precisar declarar o seu.
- Parallel route (`@slotName`, ex: `@sidebarContextual`) continua exigindo um arquivo físico na
  posição exata da URL que ela cobre — `src/app/(platform)/@sidebarContextual/academy/[courseSlug]/[lessonId]/page.tsx`
  não generaliza pro registro (é uma única posição, não uma família de rotas), mas seu conteúdo
  já é só um reexport de `@/plugins/academy/routes/lesson-sidebar/page`.
- Uma página pública que precisa escapar por completo da shell do `(platform)` (sem
  header/nav/footer — ex: `src/app/broadcast/out/[token]/`, saída de TV;
  `src/app/enrollment-dashboard/present/[token]/[institutionKey]/`, telão de apresentação) não
  pode entrar no catch-all do CMS, porque herdar `(platform)/layout.tsx` é automático assim que a
  rota mora sob esse route group — continuam como pasta própria fora de `(platform)/`, sempre um
  shim de reexport.

**Um plugin pode ser dono de uma URL que não começa pelo seu próprio nome** (ex: `academy` é dono
de `/cursos`, não só de `/academy/**`) — a `route-table.ts` "public" registra o caminho completo,
não um prefixo implícito.

## 2. Padrões proibidos

**`use case` importando `use case` de outro context:**
```ts
// ERRADO
import { publishEntry } from "@/contexts/cms/features/publishing/publish-entry/service";
```
```ts
// CERTO — via barrel público do context
import { publishEntry } from "@/contexts/cms";
```

**Plugin/tema/`platform` acessando internals de um context (mesmo só leitura):**
```ts
// ERRADO
import { rolesStore } from "@/contexts/rbac/features/role-management/store";
import { rbacSchema } from "@/contexts/rbac/database/schema";
```
```ts
// CERTO — só barrel (index.ts) e contracts/
import { getUserRoles } from "@/contexts/rbac";
import type { Role } from "@/contexts/rbac/contracts";
```

**Um plugin acessando internals de OUTRO plugin (mesmo só leitura):**
```ts
// ERRADO — caminho interno de outro plugin
import { DonationWidget } from "@/plugins/donations/components/donation-widget";
```
```ts
// CERTO — só o barrel (index.ts) ou contracts/ do outro plugin, e declarar a dependência no
// manifesto (`dependencies: [{ pluginKey: "donations", type: "optional" }]`), checando
// isPluginActive(...) em runtime quando `optional`.
import { DonationWidget } from "@/plugins/donations";
```
Import relativo DENTRO do próprio plugin continua livre — a regra só vale entre plugins distintos.

Enforcement: `boundaries/dependencies` em `eslint.config.mjs`, rodando em `npm run lint` (job
`check` do CI). Cobre `plugin`/`theme`/`platform` → `context-internal`, `plugin` → outro
`plugin` (`plugin-internal`, via capture `pluginName`), e `component` (`src/components`) →
`plugin`. Prova executável em `src/platform/page-builder/cross-plugin-boundary.eslint.test.ts`
(fixtures em `src/plugins/_fixture-cross-*/`, fora do `PLUGIN_REGISTRY` e de `globalIgnores`).

**`store.ts` novo abrindo conexão própria:**
```ts
// ERRADO
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```
```ts
// CERTO — client único, escopo de módulo
import { db } from "@/infrastructure/database/client";
```

**Cor Tailwind crua ou vocabulário próprio já eliminado:**
```tsx
// ERRADO — bloqueado por eslint no-restricted-syntax
<div className="bg-white text-gray-700 border-red-500" />
<div className="bg-surface-panel text-text-primary" />
```
```tsx
// CERTO
<div className="bg-card text-muted-foreground border-destructive" />
```

**Tema buscando dado sozinho em vez de receber props do slot:**
```tsx
// ERRADO
export function HeaderSlot() {
  const nav = useContext(NavContext);
  ...
}
```
```tsx
// CERTO — só recebe e renderiza (exceção única: useTheme() do color-mode, seção 1)
export function HeaderSlot({ brand, navItems, canToggleAdminNav }: HeaderSlotProps) { ... }
```

**Log síncrono por chamada** (era a causa do problema de desempenho do protótipo):
```ts
// ERRADO — um INSERT por log
await db.insert(logsTable).values({ message, level });
```
```ts
// CERTO — acumula em buffer, flush periódico em lote via observability/
logBuffer.push({ message, level });
```

## 3. Convenções de CSS / tokens

- **Nenhuma decisão de design (cor, raio, sombra, espaçamento, tipografia, peso, duração, curva
  de easing, proporção de escala) pode ser declarada em `src/app/globals.css`.** Esse arquivo só
  CONSOME variáveis via `var(...)`; quem define valor é sempre um tema, em
  `src/themes/<tema>/theme.css`, sob os seletores `[data-theme="<tema>"]` /
  `[data-theme="<tema>"].dark`. O `THEME_REGISTRY` (`src/themes/registry.ts`) hoje tem só o
  `venore-slime` hardcoded (fallback obrigatório, `src/themes/venore-slime/`); todo tema extra é
  um pacote `@venore/theme-*` descoberto a partir das deps do `package.json`
  (`scripts/gen-theme-registry.ts` → `registry.generated.ts` + `theme-imports.generated.css`,
  ambos gitignored). Cada tema redeclara o mesmo vocabulário sob o seu próprio
  `[data-theme="..."]`, nunca por cima de outro. `venore-slime` (`src/themes/venore-slime/theme.css`)
  é a referência: o único com o vocabulário completo garantido e o fallback imutável (ver abaixo).
  Ver `docs/themes/temas-como-pacotes-plano.md`. Isso vale inclusive para o vocabulário
  shadcn (`--background`, `--primary`, etc.) e para os multiplicadores de escala usados em
  `calc()` (ex: `--ui-radius-scale-lg: 2`, `--ui-button-padding-scale-xs: 0.5`) — o número da
  proporção é decisão de design tanto quanto a cor.
- Prova executável: `src/app/globals.no-design-values.test.ts` falha se um literal de design
  (hex, `oklch()`/`rgb()`/`color-mix()`, `cubic-bezier()`, gradiente, `px`/`rem`/`em`, duração)
  reaparecer em `globals.css`.
- **`venore-slime` é o tema oficial e fallback do sistema — nunca deve ser removido/deletado**
  de `src/themes/registry.ts` nem apagado do disco, independente de quantos outros temas estejam
  instalados. Os demais temas do registry redeclaram o mesmo vocabulário (`--background`,
  `--primary` etc.) sob seu próprio `[data-theme="..."]`, nunca por cima do `venore-slime`.
- Vocabulário de cor único do projeto é o do **shadcn** (`bg-card`, `bg-muted`, `text-foreground`,
  `text-muted-foreground`, `text-muted-foreground/56`, `border-border`, `border-ring`,
  `bg-accent/14`, `text-destructive`, `text-warning`, `bg-primary`/`text-primary-foreground`).
  Cores são declaradas em `oklch(...)` no `theme.css` de cada tema (ex:
  `src/themes/venore-slime/theme.css`), nunca hex/rgb novo, e nunca em `globals.css`.
- O vocabulário próprio anterior (`surface-*`, `text-text-*`, `border-subtle/default/strong`,
  `accent-soft`, `info-*`) foi eliminado de `src/` e não deve reaparecer — ver a tabela de
  mapeamento completa logo abaixo se precisar reconstituir um valor antigo.
- `--warning-*` (`text-warning`/`bg-warning-soft`/`border-warning-border`) é o único token
  semântico próprio que sobrevive à migração — sem equivalente shadcn, usado em
  `src/app/(platform)/academy/**`.
- **Nada de valor hardcoded** de cor/espaçamento/raio em componente de página, tema ou plugin —
  regra do documento de arquitetura. Só a parte de **cor** tem enforcement mecânico hoje
  (`no-restricted-syntax` em `eslint.config.mjs`, cobrindo `src/app`, `src/themes`,
  `src/components`, `src/plugins`, `src/platform`) mais o teste de `globals.css` acima. Raio
  (`rounded-*`) e espaçamento (`p-*`, `gap-*`) **não têm lint bloqueando valor cru** hoje — tratar
  como regra manual até existir enforcement (ver Known Gaps).
- Radius: escala derivada de uma única variável (`--radius: 0.2rem`, declarada no tema) via
  `calc()` em `@theme inline` de `globals.css` (`--radius-sm` a `--radius-4xl`), multiplicada
  pelas proporções `--ui-radius-scale-*` (também declaradas no tema) — não valores soltos por
  componente.
- **`src/components/ui/**` (primitivos shadcn stock) não é editado diretamente.** Customização
  visual sobre um primitivo vive fora dele (ex: seletor `[data-slot="button"]` em `globals.css`),
  para sobreviver a uma reinstalação via `shadcn` CLI. Exceção: `border-input` continua correto
  *dentro* dos primitivos de formulário — é convenção de scaffold do shadcn, não uma tradução
  pendente de `border-strong`.

### Tabela de migração (referência para valores antigos)

| token próprio | shadcn | observação |
|---|---|---|
| `surface-base` / `surface-canvas` | `background` | |
| `surface-panel` | `card` | |
| `surface-elevated` / `surface-subtle` | `muted` | |
| `surface-overlay` | `popover` (+ `/80` quando é scrim: `Dialog`, `MobileNavDrawer`) | |
| `text-primary` | `foreground` | |
| `text-secondary` / `text-muted` | `muted-foreground` | |
| `text-tertiary` | `muted-foreground` + `/56` fixo | replica `color-mix` antigo, pixel-idêntico |
| `text-accent` | `primary` | troca de papel, não de opacidade |
| `border-subtle` | `border` | |
| `border-default` / `border-strong` | `ring` (não `input`) | `--border-strong` == `--ring` numericamente |
| `accent-soft` | `accent` + `/14` fixo | nunca `bg-accent` sólido no lugar |
| `info-*` | `border-border bg-secondary text-secondary-foreground` | sem papel "info" no shadcn |
| `rounded-control` | `rounded-xl` | |
| `header-*`, `app-bg-*`/`app-background` | não migram — identidade do Venore Slime | `src/themes/venore-slime/theme.css` |

## 4. Mobile First

- Toda classe de layout responsivo escreve o estado **mobile sem prefixo primeiro**, depois os
  breakpoints em ordem crescente: `sm:` → `md:` → `lg:` → `xl:` → `2xl:`, na mesma ordem em que
  aparecem na string de `className`. Exemplo real (`src/app/(platform)/admin/media/page.tsx`):
  ```tsx
  <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
  ```
  Base (`grid-cols-2`) é o layout mobile; cada breakpoint adiciona/sobrescreve, nunca vem antes
  do que substitui.
- Breakpoints são os defaults do Tailwind v4 (`sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px
  / `2xl` 1536px) — não há `--breakpoint-*` customizado em `src/`.
- `lg:` é o breakpoint mais usado para alternar entre navegação mobile (drawer) e desktop
  (`MobileNavDrawer.tsx`: `lg:hidden` no overlay) e para layouts de duas colunas
  (`ContentSlot.tsx`: `lg:w-72` na sidebar contextual).

## 5. Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint — inclui `eslint-plugin-boundaries` (seção 2) e `no-restricted-syntax` de cor (seção 3) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest — só `*.test.ts` (unitário, sem banco real) |
| `npm run test:integration` | Vitest com `vitest.integration.config.ts` — só `*.integration.test.ts` |
| `npm run db:generate` / `npm run db:migrate` | Drizzle Kit — schema de core/contexts (não plugin). `db:migrate` é o único passo de migration do `vercel-build` |
| `npm run db:generate:<plugin>` / `npm run db:migrate:<plugin>` | Idem para a árvore própria de cada plugin com schema (`academy`, `birthdays`, `broadcast`, `enrollment-dashboard`). Uso local — em produção a migration do plugin roda no **install** (`platform/plugin-engine/run-plugin-migrations.ts`), não no `vercel-build` |
| `npm run db:update` | **Rodar depois de todo `git merge upstream/main`.** Consolida migrations do core + `ensureBaseRbacDataSeeded` (papéis/permissions base do "admin", cobre qualquer chave nova em `contracts/base-role-permissions.ts` sem precisar de script próprio) + `registerPlugins` + migrations de cada plugin com schema já resolvido no registro. Idempotente — seguro rodar mesmo sem nada novo pra aplicar (`scripts/update-instance.ts`). Substituiu os antigos `db:seed:<permission>` pontuais (removidos) — uma permission nova só precisa entrar em `contracts/base-role-permissions.ts`, nunca de um script novo. |
| `npm run db:bootstrap-superadmin` | Promove usuário existente a `superadmin` fora do fluxo automático |

O job `check` do CI (`.github/workflows/ci.yml`) roda `lint` → `typecheck` → `test`, sem banco. O
job `integration` é separado, sobe um container Postgres e roda só `test:integration` — não
substitui o `check`. `drizzle-kit push` é reservado para desenvolvimento local, nunca produção.

### Testes: unitário vs integração
- `*.test.ts` são unitários e não podem depender de banco real.
- `*.integration.test.ts` (ex: `client.integration.test.ts`, os do academy) exigem
  `TEST_DATABASE_URL` — **nunca reaproveitam `DATABASE_URL`**; sem a env var a suíte falha cedo
  com mensagem clara em vez de rodar contra o banco de desenvolvimento.
- `vitest.integration.config.ts` aplica, via `globalSetup` (`src/test-support/integration/global-
  setup.ts`), o core (`drizzle/`) e depois a árvore `migrations/` de **cada plugin do
  `PLUGIN_REGISTRY` que declara `migrationsPath` no manifesto** (hoje `academy`, `birthdays`,
  `broadcast`, `enrollment-dashboard`) — a lista é derivada do registro, não hardcode. Troca
  `DATABASE_URL` para `TEST_DATABASE_URL` só dentro do processo de teste (`setup-env.ts`) —
  `infrastructure/database/client.ts` não muda.
- **Isolamento entre testes é por `TRUNCATE ... CASCADE`, não transação com rollback** — vários
  `store.ts` abrem sua própria `db.transaction()`, que uma transação externa não commitada não
  cobriria sem DI só para teste.
- **`test.fileParallelism: false`** — arquivos em paralelo trunc(ariam) tabela que outro arquivo
  tem em uso no meio de um teste (sintoma observado: FK violation e asserções alternando).
- Helpers de seed ficam em `src/test-support/integration/academy-seed.ts`, fora de
  `src/contexts/*`/`src/plugins/*` de propósito (boundary não classifica esse caminho); insert
  cru em `auth.users` é o único acesso direto (não existe API pública para criar usuário), resto
  passa por `service.ts` real.
- **`next-auth` é stubado em `vitest.integration.config.ts`** (só o especificador `next-auth`,
  não `next-auth/providers/*`) porque o barrel `@/contexts/cms` reexporta handlers que sobem até
  `auth.config.ts` (`NextAuth({...})` no top-level), e `next-auth` importa `next/server`, subpath
  que só resolve dentro do bundler do Next — nunca em processo Node/Vitest puro. O stub só existe
  pra esse módulo terminar de avaliar; nenhum teste chama `handlers`/`signIn`/`signOut`/`auth` de
  verdade.

## 6. Definition of Done de uma feature

1. Segue o fluxo de camadas da seção 1, com `OperationResult<T>` em `handler`/`service`.
2. `npm run lint` passa (boundary + regra de cor).
3. `npm run typecheck` passa.
4. Tem teste unitário cobrindo `service`, e `handler` quando a feature mexe em
   autorização/validação de borda; `npm run test` passa.
5. Se toca schema: migration via `drizzle-kit generate` (nunca editar
   `__drizzle_migrations`/`_journal.json` manualmente), e o número de migrations rastreadas bate
   com o número de arquivos em `drizzle/` (core) ou na pasta `migrations/` do plugin
   correspondente (`src/plugins/<plugin>/migrations`).
6. Se cruza mais de um domínio de dado: tem teste de integração além do unitário, e
   `npm run test:integration` passa com `TEST_DATABASE_URL`.
7. Nenhum valor de cor hardcoded — só token semântico shadcn; `src/components/ui/**` não editado
   diretamente.
8. UI nova ou com mudança de layout é responsiva mobile-first (seção 4), testada visualmente em
   ao menos um breakpoint mobile e um desktop.
9. Se a função exportada por um `context` só é segura chamar via um ponto de composição em
   `platform/` (regra 14 do documento de arquitetura), o barrel tem comentário apontando pra esse
   arquivo.
10. Página administrativa nova passa pelo loader compartilhado de gate
    (`src/platform/admin-shell/get-*-page-data.ts` e equivalentes), não reimplementa a checagem
    de acesso por conta própria.

## 7. Known Gaps

`docs/issues.md` reúne pedidos/lacunas registrados durante sessões específicas (ex: plugin
`birthdays`), com o contexto de por que ficaram de fora e do que dependem para retomar. Esta seção
continua sendo a lista geral, derivada da leitura do código:

- **Radius/espaçamento sem enforcement mecânico.** O contrato de tokens proíbe `rounded-lg`/`p-3`
  hardcoded, mas `eslint.config.mjs` só tem `no-restricted-syntax` para cor. Nada bloqueia
  raio/espaçamento cru hoje.
- **TODO explícito em `assign-default-role/service.ts:7`** — "migrar para settings de plugin
  quando o manifesto existir": depende do sistema de plugins (`permissions`/`settings` no
  manifesto) ainda não estar totalmente cablado.
- **TODO explícito em `src/platform/theme-rendering/resolve-theme-slot-props.ts:7`** —
  footer/header-nav/sitemap ainda não vêm de composição real de `contexts/cms` + `contexts/rbac`.
  [NÃO VERIFICADO] o estado exato do que está mockado vs. resolvido.
- **TODO explícito em `src/themes/venore-slime/components/UserMenu.tsx:60`** — link para
  `/account` pendente porque a rota ainda não existe.
- **`src/platform/ui-preferences/` existe como diretório vazio.** O cookie que vivia lá já é
  tratado como removido (substituído por `useTheme()`/`next-themes`, seção 1), mas a pasta em si
  não foi apagada.
- ~~**Permission com escopo dentro de um recurso** (RBAC granular por seção/instância do CMS)~~ —
  **implementado (fases A–D, `docs/rbac-scoped-roles.md`, 2026-08-28):** `rbac.role_assignment_scopes`
  (vínculo usuário × papel), `authorizeActor(perm, scope?)` + `resolveScope`, recorte por
  `cms.category` nos `service.ts` de escrita do CMS (helper `contexts/cms/shared/scoped-authorization`).
  "Admin de seção" ficou como papel custom, sem `scopeType` próprio (Fase D / D7).
- **Rate limiting e controle de acesso a arquivos de mídia** — ainda não cobertos. Auditoria de
  ações sensíveis existe desde a sessão do log de eventos legível (`src/observability/audit-log.ts`
  + tabela `audit.security_audit_events`), mas só é chamada explicitamente pelas ações já
  migradas (ver `src/observability/features/clear-events/service.ts` e os `service.ts` apontados
  no comentário de `src/observability/origin-registry.ts`); a maioria das ~130 outras chamadas de
  `beginOperation`/`endOperation` no projeto ainda só gera log operacional, não auditoria — expandir
  a lista de ações que chamam `recordAuditEvent` é trabalho incremental, não builtin automático.
- **Estratégia de teste por camada não documentada** além do que a seção 5/6 deste arquivo já
  descreve — o documento de arquitetura lista isso como não coberto.
- **Plugin `birthdays` — ativação/desativação, escopo de `settings.manage`, impressão/identidade
  visual e importação CSV** ficaram fora da sessão que criou o plugin (o block `birthdays-month-
  list` já foi implementado e revisado — ver `docs/issues.md` G6). Detalhado com contexto e
  dependências em `docs/issues.md`.

## 8. Branches: `main` (core) vs branches de instância

`main` é o branch canônico do **core** do Venore Docks — toda atualização de core (contexts,
platform, themes/registry padrão, `AGENTS.md`/docs) entra por `main` primeiro, nunca direto num
branch de instância. Uma feature ou fix só nasce fora de `main` quando é genuinamente específico
de uma instância (ver abaixo); qualquer coisa que faria sentido em qualquer deploy do Venore Docks
é core e vai pra `main`.

Um branch de instância (`broadcast-fem`, `aprenda-musica`, `erasto-league`, `nestpro`, etc.)
diverge de `main` **só** no conjunto de pacotes `@venore/plugin-*`/`@venore/theme-*` que declara em
`package.json` (`git+https://...#vX.Y.Z`) — nunca em código de `src/`. `broadcast-fem`, por
exemplo, existe só porque instala `@venore/plugin-broadcast`, `@venore/plugin-scoreboard` e
`@venore/theme-fearless`; todo o resto do branch é `main`. Um commit de instância legítimo é
sempre um bump de versão desses pacotes (`chore(<plugin>): bump @venore/plugin-<nome> para
vX.Y.Z`) — nunca um `.ts`/`.tsx` de `src/` fora de `package.json`/`package-lock.json`.

**Direção do merge é sempre `main` → instância, nunca instância → `main`.** Um fix ou feature de
core encontrado enquanto o checkout está num branch de instância não é commitado ali: troca pra
`main`, commita/push lá, e só depois faz `git merge main` de volta no branch de instância pra
propagar. Nunca faz o caminho inverso (commit na instância + merge/cherry-pick pra `main`) — isso
inverteria a direção de propagação e faria `main` depender do histórico de uma instância
específica. Se um fix de core acabar commitado por engano direto num branch de instância (antes de
notar o erro), a correção é: cherry-pick o commit pra `main`, dar `git revert` dele na instância, e
então `git merge main` na instância — igual ao fluxo normal, só com um passo a mais pra desfazer o
commit fora de lugar.

## Preferências de UI: nav-mode (cookie) vs color-mode (localStorage) — assimetria intencional
`nav-mode` (`src/platform/nav-mode`) continua em cookie porque o servidor precisa saber qual
sidebar montar (main-nav vs admin-nav) no primeiro render; `color-mode` vive em `localStorage`
via `next-themes` porque só a classe `dark` no client depende dele. Não unificar os dois mecanismos.
<!-- END:venore-docks-rules -->
