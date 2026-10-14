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
  Os hooks/stores do kit de tema v8 (`src/theme-sdk/kit/hooks`, `kit/stores`: colapso da rail,
  overlay/drawer, scroll lock, estado de scroll do header) são estado de UI no client, não busca
  de dado — o dado continua chegando por prop, resolvido em `platform/theme-rendering`.

### 1.1 Rotas de plugin: `app/` não conhece nomes de plugin, tudo mora em `src/plugins/<nome>/routes/`

Plugin nunca tem página, `action.ts` ou route handler em `src/app/`, nem pasta de `app/` com nome de plugin.
Toda rota de plugin é uma entrada em `src/plugins/<nome>/routes/route-table.ts` (áreas `admin`, `public`, `api`,
`sidebarContextual`, `standalone`), despachada por cinco pontos genéricos de `app/`. Detalhe completo, exceções
físicas do Next.js e metadata de rota pública: `.claude/rules/plugin-routes.md` (carregado automaticamente ao
mexer em `src/plugins/**`, `src/platform/plugin-*/**`, `src/app/api/**`, `src/app/ext/**` ou em `page.tsx`).

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

Resumo: nenhum valor de design em `src/app/globals.css` (só `var(...)`); valores moram no `theme.css` de cada
tema; vocabulário de cor único = shadcn (`bg-card`, `text-muted-foreground`, `border-border`…), cores em `oklch`;
`venore-slime` é o fallback e nunca é removido; `src/components/ui/**` não é editado. Contrato de tema 8.0.0,
gate `npm run theme:check`, tabela de migração dos tokens antigos e o resto: `.claude/rules/css-tokens.md`
(carregado automaticamente ao mexer em `*.tsx`, `*.css`, temas, kit ou `platform/theme-*`).

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
| `npm run db:generate` / `npm run db:migrate` | Drizzle Kit — schema de core/contexts (não plugin). O `prebuild` (logo, todo `vercel-build`) aplica via `scripts/migrate-on-build.mjs` — **exceto em preview da Vercel** (só com `MIGRATE_ON_PREVIEW=true`) e com `SKIP_DB_MIGRATIONS=true`. Migrations compatíveis com o código no ar: `docs/migrations-guia.md` |
| `npm run db:migrate:plugins` | Migrations pendentes de cada plugin **já instalado** (`scripts/migrate-installed-plugins.ts`). Roda no `prebuild` depois das do core (mesmas exceções de preview) — bump de tag de plugin com migration nova se aplica sozinho no deploy da Vercel, sem `db:update`. Falha de migration derruba o build (o deploy anterior continua no ar). A **primeira** migration de um plugin continua rodando no install (`/admin/plugins` → `platform/plugin-engine/run-plugin-migrations.ts`); plugin nunca instalado é pulado |
| `npm run db:update` | **Rodar depois de todo `git merge upstream/main`.** Consolida migrations do core + `ensureBaseRbacDataSeeded` (papéis/permissions base do "admin", cobre qualquer chave nova em `contracts/base-role-permissions.ts` sem precisar de script próprio) + `registerPlugins` + migrations de cada plugin com schema já resolvido no registro. Idempotente — seguro rodar mesmo sem nada novo pra aplicar (`scripts/update-instance.ts`). Substituiu os antigos `db:seed:<permission>` pontuais (removidos) — uma permission nova só precisa entrar em `contracts/base-role-permissions.ts`, nunca de um script novo. |
| `npm run db:bootstrap-superadmin` | Promove usuário existente a `superadmin` (alternativa ao `/setup` com `SETUP_TOKEN`) |
| `npm run test:plugins` | Testes dos plugins da instância (`VENORE_INSTANCE`; vazio = todos) (`vitest.plugins.config.ts`, procura em `../venore-plugin-<nome>`) |
| `npm run test:e2e` | Playwright (`e2e/`) — setup + login num banco vazio; exige build, `DATABASE_URL`, `AUTH_SECRET`, `SETUP_TOKEN` |

O CI (`.github/workflows/ci.yml`) roda em todo branch e em PR, no "venore vanilla" (seção 8). O job
`check` roda `lint` → `typecheck` → `test`, sem banco; `instances` roda codegen estrito + typecheck de
cada `instances/*.json`; `plugins` roda `test:plugins` com os pacotes
de `node_modules/@venore/plugin-*`; `integration` sobe um Postgres e roda `test:integration`;
`smoke` e `e2e` fazem o build e sobem o app. Nenhum substitui o `check`.

`src/app/server-actions-authorization.test.ts` chama **toda** função exportada de arquivo
`"use server"` sem sessão e falha se ela gravar no banco/storage ou chamar a rede. Action pública
de verdade (login, cadastro, setup) entra na lista `PUBLIC_ACTIONS` do teste, com o motivo. `drizzle-kit push` é reservado para desenvolvimento local, nunca produção.

### Testes: unitário vs integração
- `*.test.ts` são unitários e não podem depender de banco real.
- `*.integration.test.ts` (ex: `client.integration.test.ts`, os de `src/test-support/integration/`) exigem
  `TEST_DATABASE_URL` — **nunca reaproveitam `DATABASE_URL`**; sem a env var a suíte falha cedo
  com mensagem clara em vez de rodar contra o banco de desenvolvimento.
- `vitest.integration.config.ts` aplica, via `globalSetup` (`src/test-support/integration/global-
  setup.ts`), o core (`drizzle/`) e depois a árvore `migrations/` de **cada plugin do
  `PLUGIN_REGISTRY` que declara `migrationsPath` no manifesto** (no CI, o registro "vanilla" com
  todos os plugins do `package.json`, seção 8) — a lista é derivada do registro, não
  hardcode. Troca `DATABASE_URL` para `TEST_DATABASE_URL` só dentro do processo de teste
  (`setup-env.ts`) —
  `infrastructure/database/client.ts` não muda.
- **Isolamento entre testes é por `TRUNCATE ... CASCADE`, não transação com rollback** — vários
  `store.ts` abrem sua própria `db.transaction()`, que uma transação externa não commitada não
  cobriria sem DI só para teste.
- **`test.fileParallelism: false`** — arquivos em paralelo trunc(ariam) tabela que outro arquivo
  tem em uso no meio de um teste (sintoma observado: FK violation e asserções alternando).
- Helpers de seed ficam em `src/test-support/integration/` (`user-seed.ts`, `rbac-seed.ts`), fora de
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

Lista em `docs/known-gaps.md` (ler quando a tarefa tocar uma área listada lá); pedidos por sessão em
`docs/issues.md`. Divergência entre doc e código vira entrada nova lá, não correção silenciosa.

## 8. Instâncias: um branch só (`main`) + `instances/<nome>.json`

Um branch só (`main`); cada projeto da Vercel escolhe o subconjunto de plugins/temas pela env `VENORE_INSTANCE`
(`instances/<nome>.json`); vazio = "venore vanilla", com tudo (é o que roda no CI). Nada de
`if (VENORE_INSTANCE === "x")` em `src/`. Fluxos (nova instância, bump, ligar/desligar pacote):
`.claude/rules/instancias.md` (carregado ao mexer em `instances/**`, `package.json`, `scripts/**`, workflows).

## 9. Economia de tokens nas sessões

Cada chamada ao modelo relê o contexto inteiro da sessão: numa sessão com 500 mil tokens, cada passo custa
dez vezes o de uma com 50 mil. Nas sessões medidas em out/2026, reler contexto foi ~87–93% do consumo.

- **Uma sessão por tarefa.** Entregou, encerra. Assunto novo = sessão nova (na nuvem não existe `/clear`). O
  que precisa sobreviver vai para a passagem de sessão (skill `passagem-de-sessao`), nunca para "a mesma
  sessão continua amanhã".
- **Effort pela tarefa:** medium para bump, doc, ajuste de teste e fix pequeno; high para feature; xhigh só para
  arquitetura nova ou bug que resistiu a uma tentativa.
- **Bump de plugin/tema não precisa de sessão longa.** Use a skill `bump-plugin` numa sessão curta (medium); para
  iterar num plugin, aponte o core para o clone local (`npm pkg set "dependencies.@venore/plugin-X=file:../venore-plugin-X"`,
  sem commitar) e só faça bump no marco.
- **Anexe só os repositórios que vão mudar.** Para consultar outro, use o subagente `explorador` ou leia o arquivo
  pontual pelo GitHub.
- **Busca ampla e log grande vão para subagente** (`.claude/agents/explorador.md`, `leitor-de-ci.md`): só a
  conclusão volta para o contexto principal.
- **Higiene de saída** — nunca despejar o que não vai ser lido:
  - ferramentas do GitHub com `fields`/`minimal_output`/`perPage` pequeno; log de job com `tail_lines` ≤ 150;
  - `git log --oneline -n 20`, `git diff --stat` antes do diff completo;
  - `npx vitest run <arquivo> --reporter=dot`, `npm ci --no-audit --no-fund --loglevel=error`;
  - ler arquivo grande por faixa (`offset`/`limit`) ou com `grep -n`, não inteiro;
  - não reler arquivo que você acabou de editar.
- **Não ler `docs/` inteiro por precaução.** Os docs citados aqui são para quando a tarefa toca a área; as regras
  de `.claude/rules/` já carregam sozinhas quando um arquivo casado é lido ou editado.
- `AGENTS.md` tem orçamento de tamanho (`src/test-support/claude-config.test.ts`): conteúdo detalhado novo vai
  para uma regra com `paths:` em `.claude/rules/`, não para cá.

## Preferências de UI: nav-mode (cookie) vs color-mode (localStorage) — assimetria intencional
`nav-mode` (`src/platform/nav-mode`) continua em cookie porque o servidor precisa saber qual
sidebar montar (main-nav vs admin-nav) no primeiro render; `color-mode` vive em `localStorage`
via `next-themes` porque só a classe `dark` no client depende dele. Não unificar os dois mecanismos.
<!-- END:venore-docks-rules -->
