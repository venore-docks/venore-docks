# Venore Docks
`Version do documento: 2.0.1-forge`

> `CORE_VERSION` (usado em `compatibility.coreVersion` do manifesto de plugin) é um semver puro, sem sufixo de prerelease, vivendo em código (`platform/plugin-engine/core-version.ts`) — deliberadamente desacoplado do "Version" acima. Sufixo de prerelease quebra `semver.satisfies` contra faixas como `>=2.0.0 <3.0.0` por padrão; a versão do documento pode evoluir livremente sem afetar checagem de compatibilidade de plugin.

## Resumo
Venore Docks é um boilerplate — não uma plataforma multi-tenant — que integra autenticação, RBAC, observabilidade, gerenciamento de conteúdo, gerenciamento de mídia, banco de dados (Postgres) e customização de UI (temas), com capacidades específicas de cada site chegando através de plugins.

Cada site é uma instância própria: `git clone` do repositório original, customização, deploy independente. O core deve fornecer as capacidades básicas prontas, sem se preocupar com o que cada site vai precisar de específico — isso é papel do plugin daquele site.

### Modelo de atualização (fork + upstream)
Cada site mantém o repositório do Venore Docks como remote `upstream` e traz melhorias do core via `git fetch upstream && git merge upstream/main`. Esse modelo já foi validado em produção e deve continuar:
- `core/` evolui no repositório original e se propaga por merge.
- Cada site mantém seus próprios plugins e customizações sem conflito, desde que não edite arquivos de `core/` diretamente.
- Migrations de banco seguem numeração sequencial; conflito de migration entre core e site se resolve renumerando a migration local, nunca a do upstream.

## Sobre temas
Temas são instalados no código (arquivo/pacote), mas a escolha de qual tema está ativo é uma configuração trocável em runtime pelo admin — não é fixada no deploy. O core mantém um registro dos temas instalados e qual está ativo; trocar de tema não exige rebuild, só a mudança dessa configuração.

O tema ativo (e qualquer configuração trocável em runtime, incluindo `registrationApprovalRequired` e o papel padrão de registro, hoje via env var como solução provisória) vive em `contexts/settings` — key-value por site, não em variável de ambiente. Variável de ambiente exige redeploy pra mudar; não serve pra algo que um admin troca num painel.

### Shell única — sem área admin separada
Não existe uma "área admin" com casca própria, independente do tema. Existe **uma shell**, um único `Header`/`Footer`/`Content`/`SidebarLeft`, e a navegação alterna entre `main-nav` e `admin-nav` através de um controle no próprio Header — visível só para quem tem alguma permission administrativa. CSS, espaçamento, cor, tudo continua vindo do mesmo tema, nos dois modos. Isso substitui a decisão anterior de admin shell independente (documentada até esta versão) — código já implementado com casca própria é dívida a retrofitar, não o padrão a seguir daqui em diante.

Mecanicamente, isso é um route group do Next.js: `app/(platform)/` contém tanto as páginas públicas (`[...slug]`, `academy`, etc.) quanto `app/(platform)/admin/**` — todos puxando o **mesmo** `(platform)/layout.tsx`, que monta a shell uma vez. `admin` continua existindo como path normal; a diferença é só que ele não tem `layout.tsx` próprio, herda o do grupo. Um grupo `(auth)` separado (login, setup) não usa a shell cheia — não precisa dela.

O gate de página (regra 13) continua existindo e continua sendo checado no servidor — o que muda é só o *modo de apresentação*: uma página administrativa renderiza dentro da mesma shell/tema, no modo `admin-nav`, em vez de um layout à parte.

### Contrato de design tokens — proibido valor hardcoded
Nenhum componente (tema, admin, página pública) escreve valor de cor, espaçamento ou raio de borda diretamente — nada de `bg-white`, `p-3`, `rounded-lg` com valor fixo do Tailwind. Todo valor visual vem de uma variável CSS semântica, mapeada no tema ativo via `@theme inline` do Tailwind v4, seguindo o padrão:

```css
:root {
  --surface-panel: oklch(0.991 0.004 145);
  --text-primary: oklch(0.235 0.026 176);
  --radius: 0.2rem;
  --sidebar-bg-admin-start: oklch(0.97 0.01 160); /* admin-nav pode ter variação sutil própria, ainda dentro do tema */
}

@theme inline {
  --color-surface-panel: var(--surface-panel);
  --color-text-primary: var(--text-primary);
  --radius-md: var(--radius);
}
```

Motivo: dois temas podem ter `border-radius` completamente diferente (`0` num, `1rem` noutro) ou fundo claro diferente (`#FFF` vs `#ccc`) — se o valor estiver hardcoded num componente (`rounded-lg`, `bg-white`), trocar de tema não muda nada ali, porque o componente nunca consultou o tema pra começo de conversa. Categorias mínimas de token que todo tema precisa fornecer: cor de superfície (`surface-*`), cor de texto (`text-*`), borda (`border-*`), raio (`radius-*`), sombra (`shadow-*`) — cada uma com variantes semânticas (ex: `surface-panel`, `surface-elevated`, `surface-overlay`), não só uma cor genérica por categoria.

Os temas customizam todo o design do site, incluindo CSS e shells. A plataforma vai ter áreas definidas que podem ser manipuladas pelos temas:

### Áreas estruturais
1. Header
   1.1 Brand
   1.2 Userbar (pode ativar ou desativar para sites que não têm usuários)
   1.3 Controle de alternância main-nav / admin-nav (visível só para quem tem alguma permission administrativa)
2. Footer
   2.1 Brand
   2.2 Sitemap
   2.3 Credits (pode ativar ou desativar)
3. Content
   3.1 Sidebar Contextual (pode ativar ou desativar)
4. Sidebar Left (pode ativar ou desativar)

### Áreas dinâmicas
1. Navegações (`main-nav`, `admin-nav`, `header-nav`, `contextual-nav`, `user-nav`, `sitemap`)
2. Breadcrumbs
3. Page Headers (pode ativar ou desativar)

A navegação administrativa (`admin-nav`) é resolvida no servidor, item por item, filtrada pela permission do ator — nunca a lista completa é montada e depois escondida no client. Esconder item de menu não substitui a regra 13 (gate de página): um item ausente do menu não significa que a rota por trás dele está protegida, e uma rota protegida não dispensa filtrar o menu (usuário sem acesso não deveria nem ver o link).

### Contrato de slot

Um tema é obrigado a exportar exatamente um componente: `Shell`, que recebe `ThemeShellProps`
(`header`, `footer`, `sidebarLeft`, `children`, `sidebarContextualEnabled`, `sidebarContextual` —
tudo já resolvido, o tema nunca busca dado sozinho). É o `Shell` quem decide a árvore/arranjo
entre as regiões estruturais — ordem, lado da sidebar, se alguma região existe ou não — nunca
`platform/`. Isso é deliberado (docs/themes/shell-contract.md — Abordagem A, decidida sobre uma
Abordagem B de configuração declarativa): dar ao tema a posse total do layout, não só do
estilo, porque a alternativa (vocabulário de arranjo antecipado pela aplicação) quebra assim que
um tema precisa de um arranjo que a aplicação não previu — o que já aconteceu uma vez neste
mesmo repositório, na região contextual (`docs/ui/shell-spec.md` §1).

Internamente, `Shell` pode ser composto por quantos componentes o tema quiser (o Venore Slime usa
`HeaderSlot`/`FooterSlot`/`ContentSlot`/`SidebarLeftSlot` como peças internas, ver
`src/themes/venore-slime/components/Shell.tsx`) — isso é implementação do tema, não parte do
contrato. Só `Shell` é exigido por `THEME_REGISTRY` (`src/themes/registry.ts`).

**Venore Slime** é ao mesmo tempo o tema padrão e o `fallback` — não são dois temas diferentes. Os valores dele (cor, tipografia, raio, sombra) ficam embutidos no código (não dependem de linha em `contexts/settings` nem de banco), usado sempre que a resolução de tema ativo falhar por qualquer motivo — não só ausência de configuração. Essa é a garantia que importa: um tema de terceiro pode ser instalado e escolhido depois, mas o Venore Slime nunca deixa de existir como opção resolvível sem depender de runtime.

Isso cobre só a falha de *configuração* (tema ativo ausente, ou apontando pra uma chave fora do
`THEME_REGISTRY`). Uma falha diferente — um tema registrado mas sem `Shell` válido (estrutural,
não de configuração) — não cai nesse fallback: é erro explícito na carga
(`resolve-active-theme.ts`), porque a aplicação não tem (e não pode ter) uma shell própria de
reserva que mascare um tema incompleto.

`ThemeShellProps` (mínimo que todo `Shell` recebe):

| Campo | Conteúdo |
| --- | --- |
| `header` | `brand`, `userbarEnabled`, `headerNavItems`, `user`, `canAccessAdmin`, `onSignOut` |
| `footer` | `brand`, `sitemapItems`, `creditsEnabled` |
| `sidebarLeft` | `enabled`, `navMode` (`"main" \| "admin"`), `navItems`/`navGroups` (conforme `navMode`), `canToggleAdminNav`, `onToggleNavMode`, `collapsed`, `onToggleCollapsed` |
| `children` | conteúdo resolvido da página |
| `sidebarContextualEnabled`, `sidebarContextual` | conteúdo contextual já resolvido (ou `null`) |

Regras do contrato de slot:
- O tema recebe **dados já resolvidos** (ex: itens de navegação já filtrados por permissão) — nunca uma referência crua a `context` para ele mesmo buscar.
- Um tema pode optar por não renderizar uma região (ex: não ter `SidebarLeft`) — decisão de design do próprio tema, não requer aprovação de `platform/`. O que o tema não pode é não exportar `Shell` — isso não é "região ausente", é carga malformada (ver acima).
- Toda prop nova que `ThemeShellProps` passar a receber precisa ser uma mudança versionada do contrato (`themeContractVersion`), porque temas de terceiros/sites diferentes dependem dela.
- Nenhum componente do tema usa valor hardcoded — só as variáveis do contrato de design tokens acima.
- O arranjo espacial entre as regiões (que fica ao lado de quê, que existe ou não, sticky ou não) é sempre decisão do `Shell` do tema — nunca de `platform/`. `platform/` só resolve dados e repassa pro `Shell`.

**Exceção deliberada — dark/light toggle**: desde `themeContractVersion` `3.0.0`, o color mode não é mais resolvido pelo core e passado como prop (`isDark`/`onToggleColorMode` foram removidos de `HeaderSlotProps`). O tema lê e altera o tema via `useTheme()` do `next-themes` diretamente (`src/components/color-mode-toggle.tsx`). Isso é a única exceção conhecida a "o tema nunca busca dado sozinho" — decisão explícita do usuário (2026-07-28), ao reinstalar os primitivos shadcn stock: o `sonner` stock exige `next-themes`, e sincronizar esse hook com o cookie anterior (`platform/ui-preferences`, já removido) criaria dois mecanismos de tema concorrentes. Trade-off deliberado, não um desvio silencioso — ver o comentário completo em `src/contexts/themes/contracts/contract-version.ts`.



## Stack inicial
- Next.js (framework React)
- Tailwind (CSS)
- shadcn (elementos UI)
- Auth.js (autenticação)
- Drizzle ORM + Postgres (persistência)
- Vitest (testes)

## Persistência e conexão com banco

Banco: Postgres gerenciado via **Neon**, provisionado através da integração Vercel-Neon — um banco por instância/site.

### Driver e pool
- Driver: `node-postgres` (`pg`) via `drizzle-orm/node-postgres` — não o driver HTTP serverless da Neon. Em ambiente Vercel com Fluid Compute, TCP com pool gerenciado é a recomendação atual da própria Neon/Vercel, porque reaproveita a conexão entre invocações da function em vez de abrir uma nova a cada request.
- O pool é aberto em **escopo de módulo** (`infrastructure/database/client.ts`), nunca dentro de um handler de rota — pool criado dentro do handler vaza conexão a cada invocação em serverless.
- Usar `attachDatabasePool` do pacote `@vercel/functions` para o runtime da Vercel drenar conexões ociosas antes de suspender a instância.

```ts
// infrastructure/database/client.ts
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

export const db = drizzle({ client: pool });
```

### Configuração
- Connection string: variável de ambiente `DATABASE_URL`, uma por instância/site — mesmo padrão já usado para client ID/secret do Google OAuth.
- Migrations: `drizzle-kit generate` + aplicação em CI/deploy. `drizzle-kit push` fica reservado para desenvolvimento local, nunca produção.
- Nunca editar `drizzle.__drizzle_migrations` ou `drizzle/meta/_journal.json` manualmente fora do fluxo padrão do `drizzle-kit` — um timestamp inconsistente entre os dois faz o migrator pular migration subsequente **silenciosamente, reportando sucesso**. Depois de qualquer sessão que gere migration, confirme o número de migrations rastreadas bate com o número de arquivos em `drizzle/migrations`, não só que o comando não deu erro.
- Todo `context`, `plugin` e o core acessam o banco através desse client único exportado por `infrastructure/database` — nenhum arquivo `store.ts` cria sua própria conexão.

### Schema do Postgres por domínio
Cada `context` (e cada `plugin`, seguindo a mesma regra de "domínio próprio no banco" já definida em "Sistema de plugins") declara seu próprio schema real do Postgres via `pgSchema`, não só prefixo de nome de tabela:

```ts
// contexts/rbac/database/schema/index.ts
import { pgSchema, uuid, text } from "drizzle-orm/pg-core";

export const rbacSchema = pgSchema("rbac");

export const roles = rbacSchema.table("roles", {
  id: uuid("id").primaryKey(),
  key: text("key").notNull(),
  // ...
});
```

Isso adiciona uma proteção a mais além do `eslint-plugin-boundaries`: join acidental entre domínios vira erro de SQL, não só erro de lint — a barreira existe também dentro do banco, não só no código.

## Organização pretendida

### Arquivos por use case

| Arquivo | Papel |
| --- | --- |
| `handler.ts` | Orquestração do use case: valida input, autentica, autoriza (RBAC), chama exatamente UM `service`. Não acessa banco, não contém regra de negócio. |
| `service.ts` | Toda a regra de negócio do use case. Orquestra `store`. Não acessa banco diretamente, não depende de UI/framework. |
| `store.ts` | Único ponto de acesso a dados do use case. Não contém regra de negócio, não valida, não autoriza. |
| `view.ts` | View model, presenter ou DTO de saída. |
| `types.ts` | Tipos, comandos, resultados, eventos e erros. |

`handler.ts` e `service.ts` existem como arquivos separados mesmo quando pequenos — a separação existe para permitir testar regra de negócio isolada de teste de borda (auth/validação), não para organização estética.

### Formato de resultado

```ts
type OperationResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

`handler` e `service` sempre retornam `OperationResult<T>` — nunca lançam exception para um erro de negócio esperado (ex: "email já cadastrado", "sem permissão"). Exception fica reservada para falha não esperada (infraestrutura fora do ar, bug). Sem esse contrato fixo, cada use case inventa sua própria forma de sinalizar erro, e quem consome (handler de outro context, ou `app/`) não sabe o que verificar.

### Exemplo de árvore de pastas

```
contexts/
  rbac/
    index.ts                      # barrel público — só o que o context expõe
    contracts/
    features/
      role-management/
        update-role-permissions/
          handler.ts
          service.ts
          store.ts
          view.ts
          types.ts

plugins/
  birthdays/
    manifest.ts
    features/
      birthday-registration/
        create-birthday/
          handler.ts
          service.ts
          store.ts
          types.ts
```

### Estrutura de pastas

| Pasta | Papel |
| --- | --- |
| `app/` | Camada exclusiva do Next.js para rotas e route handlers. Não é contexto, slice ou lugar de regra de negócio — só chama a API pública de um `context`. |
| `contexts/` | Domínios (contextos) principais da plataforma. |
| `plugins/` | Capacidades específicas de cada site. |
| `infrastructure/` | Implementações de infraestrutura e adapters. |
| `observability/` | Monitoramento geral (logs, métricas e tracing). |
| `shared/` | Kernel compartilhado: tipos e constantes usados por todo o sistema (ex: `OperationResult<T>`). Só tipo/constante — zero lógica de negócio, zero acesso a dado. Importável por qualquer `context` ou `plugin` sem violar boundary, porque não carrega regra de domínio nenhuma. |
| `platform/` | Raiz de composição entre contexts que não pode viver dentro de nenhum context sozinho, conforme regra 12 (ex: wiring do evento de registro do NextAuth chamando `auth` + `rbac`). Só código de composição — nunca regra de negócio de domínio, nunca substitui a comunicação via barrel entre contexts. |

### Regras de limites de contexto (boundary)

| # | Regra |
| --- | --- |
| 1 | Contexto (`context`) é a principal fronteira modular. |
| 2 | O contexto é composto por características (`feature`) independentes para evolução, teste e deploy lógico. |
| 3 | Características (`feature`) são compostas por casos de uso (`use case`). |
| 4 | Comunicação entre `feature` deve ocorrer por contratos públicos do `context`. |
| 5 | Um `use case` não deve importar diretamente outro `use case` de outro contexto. |
| 6 | `Infrastructure` e `Observability` são capacidades técnicas consumidas por portas/adapters. Não devem ser acopladas. |
| 7 | Um `plugin` só pode importar de `contexts/<nome>/contracts` e de `contexts/<nome>/index.ts` — o barrel público do context, que reexporta só as funções de `service` que o context decide expor. Nunca de `store`, `schema`, `database/client`, ou de um arquivo de `service` importado direto fora do barrel. Isso vale tanto para leitura quanto para escrita. |
| 8 | Todo acesso de um plugin a dado de outro domínio passa pelo barrel público do context (que só expõe função de `service`), mesmo que seja só leitura. Join direto em tabela de outro context, ou import de `store`/`service` fora do barrel, é proibido, não só update/insert. |
| 9 | Essa regra precisa de enforcement mecânico (ex.: `eslint-plugin-boundaries` restringindo import de `plugins/**` para qualquer caminho profundo dentro de `contexts/**` — só `contexts/<nome>/index.ts` e `contexts/<nome>/contracts/**` são permitidos), não só de documentação — regra escrita sem lint vira regra ignorada sob prazo. |
| 10 | Um `service` pode chamar o `service` público (via `index.ts` barrel) de outro `context` diretamente, para compor dado de mais de um domínio (ex: resolver uma página precisa de CMS + RBAC). Isso não contradiz a regra 5 — a regra 5 proíbe `use case` importando `use case` de outro context; chamar a API pública de outro context é o canal permitido. |
| 11 | Dependência entre contexts não pode ser cíclica: se `cms` chama `rbac`, `rbac` não pode chamar `cms` de volta. Dependência entre contexts é uma hierarquia, não uma rede — isso evita acoplamento disfarçado de composição. |
| 12 | Hierarquia declarada: `auth` não depende de nenhum outro context. `rbac` depende de `auth` (para resolver o ator). `settings` depende de `auth` e `rbac` (para checar permissão de alterar configuração). Contexts de domínio (CMS, mídia, temas, etc.) podem depender de `auth`, `rbac` e `settings`, nunca o contrário. Composição que pareça exigir que um context "de baixo" chame um "de cima" deve morar fora dos dois — num ponto de wiring (ex: o handler de evento do NextAuth chamando uma função de composição externa aos contexts), nunca como import direto de um context "de baixo" para um "de cima". |
| 13 | Toda página administrativa (ex: gerenciamento de RBAC, CMS, Academy) usa um loader compartilhado por seção (ex: `getSettingsPageData()`) que resolve o ator e barra acesso antes de a página renderizar — não é responsabilidade de cada página individual repetir essa checagem. Isso é sobre "quem pode ver essa página", separado da autorização dentro do `handler` de cada `context` (que é sobre "quem pode executar essa ação"). O gate roda no servidor independente de existir ou não uma casca visual separada — a partir da decisão de shell única, ele decide acesso à página, não a um layout à parte. |
| 14 | Uma função exportada por um `context` que só é segura chamar através de um ponto de composição em `platform/` (ex: `deleteMedia`, que devia ser precedida por checagem de uso em `cms`) recebe um comentário no próprio código-fonte, no ponto de exportação do barrel, apontando para o arquivo de `platform/` que deveria ser usado no lugar. Já aconteceu duas vezes (registro de usuário, exclusão de mídia) sem mecanismo de bloqueio — por ora é convenção de comentário, não lint; numa terceira ocorrência, vale desenhar enforcement de verdade. |
| 15 | O menu administrativo (`nav-admin`) é resolvido no servidor, por ator — cada item só existe na resposta se o ator tiver a permission correspondente, nunca renderizado e escondido via CSS/client. Nav filtrado complementa a regra 13, mas nunca substitui: esconder um item de menu não protege a rota por trás dele. |

### Regras de `use cases`

| # | Regra |
| --- | --- |
| 1 | `use cases` devem nascer de cenários BDD. |

## Sistema de plugins

Um plugin declara, num manifesto próprio, o que contribui para a plataforma — o core lê o manifesto para saber o que existe, o plugin nunca escreve direto em tabela do core para se registrar.

Pontos de extensão oficiais (a expandir conforme necessidade real aparecer, não antecipadamente):
- `permissions`
- `settings`
- `navigation`
- `routes`
- `contentTypes`
- `blocks`
- `seeds`

Regras:
- Cada plugin cria seu próprio domínio dentro do banco (schema ou prefixo de tabela próprio) — nunca escreve em tabela de outro plugin ou do core.
- Chave do plugin (`key`) é única, kebab-case, estável ao longo do tempo.
- Módulo inválido ou com dependência quebrada não deve travar o bootstrap dos demais.
- Instalar um plugin (`platform/plugin-engine/install-plugin.ts`) roda as migrations dele, concede
  as `permissions` declaradas ao papel `admin` (aditivo e idempotente — `superadmin` não precisa)
  e, se pedido, roda os `seeds`. Botão "Popular dados de exemplo" em `/admin/plugins` roda os
  `seeds` de um plugin já instalado (`platform/plugin-engine/seed-plugin.ts`, gateado por
  `platform.extensions.manage`).

### Contrato de manifesto

```ts
type PluginManifest = {
  manifestVersion: string;
  key: string;              // kebab-case, único, estável
  name: string;
  version: string;
  description?: string;

  dependencies?: { pluginKey: string; type: "required" | "optional" }[];
  compatibility?: { coreVersion: string };  // semver range, ex: ">=2.0.0 <3.0.0"

  permissions?: { key: string; label: string }[];   // namespace: "<plugin>.<recurso>.<acao>"
  settings?: { key: string; defaultValue: unknown }[];
  // icon/groupKey/groupLabel/groupOrder/order/requiredPermission espelham AdminNavItemDefinition
  // (platform/admin-shell/admin-navigation.contracts.ts) — o registro de navegação admin agrega
  // o item de um plugin exatamente como agrega o de um context, sem lista central enumerando
  // telas à mão.
  navigation?: {
    key: string;
    label: string;
    href: string;
    icon: string;
    groupKey: string;
    groupLabel: string;
    groupOrder: number;
    order: number;
    requiredPermission?: string | string[];
  }[];
  routes?: { path: string; label: string }[];
  contentTypes?: { key: string; label: string }[];
  blocks?: { key: string; label: string }[];
  // Dados de exemplo. Cada `key` mapeia para uma função em src/plugins/<key>/seeds/<seedKey>.ts
  // (registrada em platform/plugin-engine/plugin-seed-registry.ts) que devolve
  // OperationResult<void> e é idempotente (list-then-skip). Rodados no install (opcional) ou pelo
  // botão "Popular dados de exemplo" de /admin/plugins.
  seeds?: { key: string; label: string; description?: string }[];

  // Migrations próprias do plugin (ver "Schema e migrations"). Ausente == plugin sem schema
  // próprio (settings-only). Presente == a 1ª aplicada no install; as seguintes no build.
  migrationsPath?: string;    // relativo à pasta do plugin, ex: "./migrations"
  migrationsSchema?: string;  // default: key com "-"→"_" + "_migrations"
  migrationsTable?: string;   // default: "__drizzle_migrations"
};
```

Regras de dependência:
- `dependencies` obrigatória (`required`) impede ativação do plugin se a dependência não estiver ativa.
- `dependencies` opcional (`optional`) só desativa a funcionalidade específica que depende dela, sem bloquear o plugin inteiro.
- Ciclo de dependência entre plugins é inválido e bloqueia o registro de ambos, com erro explícito — nunca falha silenciosa.
- Plugin com manifesto inválido não derruba o bootstrap dos demais plugins.
- Depois de um `git merge upstream/main`, todo plugin tem seu `compatibility.coreVersion` checado contra a versão do core recém-atualizada. Fora da faixa declarada, o plugin é marcado `incompatible` e não é ativado — em vez de quebrar em runtime quando um `service` público de um context mudou de assinatura.

### Schema e migrations
- Configuração do Drizzle aponta para os schemas de core, contexts e plugins por glob (ex: `src/contexts/*/database/schema/index.ts`, `src/plugins/*/database/schema/index.ts`).
- Cada plugin numera suas próprias migrations dentro da própria pasta — migrations de plugins diferentes não competem entre si porque vivem em pastas separadas; só migration de core vs. site (já coberto em "Modelo de atualização") compete por número.
- Cada plugin com schema próprio usa uma tabela de tracking dedicada (`migrationsSchema` no manifesto / no `drizzle.config.ts`), nunca `"drizzle"."__drizzle_migrations"` — o algoritmo de `migrate()` do drizzle-orm compara só o `created_at` mais recente da tabela, então compartilhar a tabela com o core faz uma migration de plugin mais antiga que a última do core ser pulada em silêncio.
- **A primeira migration de plugin roda no install; as seguintes, no build.** Instalar um plugin pelo site (`platform/plugin-engine/install-plugin.ts`) chama `runPluginMigrations(key)`, que aplica a árvore de `migrationsPath` daquele plugin com o `migrationsSchema`/`migrationsTable` do manifesto. Depois disso, o `prebuild` (`scripts/migrate-on-build.mjs` → `scripts/migrate-installed-plugins.ts`) aplica as migrations pendentes de todo plugin **já instalado** logo após as do core — bump de versão de plugin com migration nova se aplica sozinho no deploy (desde a 0.5.0); plugin nunca instalado é pulado. Enquanto um plugin está "available" (presente no código, sem estado de instalação em `extensions.extension_state`), ele não contribui nada e seu schema não é criado.

## Autenticação

Provedor inicial: Google OAuth, via Auth.js. Client ID e secret são configurados por variável de ambiente, um par por instância/site (cada site tem seu próprio client OAuth no Google).

### Identidade separada de credencial
O modelo de usuário separa **identidade** (o registro `user`, dono dos papéis de RBAC) de **credencial** (o vínculo com o provider usado para provar quem é aquele usuário) — mesmo havendo só um provider ativo hoje. É o padrão nativo do adapter do Auth.js (tabela de contas vinculada a usuários), não uma camada extra a construir. O motivo de fixar isso agora: quando o login por OTP (senha única por email) entrar, ele deve virar só mais um provider vinculado ao mesmo `user` — nunca uma migração de dado de usuário existente.

### Fluxo de registro (configurável por site)
O core oferece o fluxo como capacidade, mas cada site liga ou desliga via configuração (`settings`) — não é comportamento fixo obrigatório:
1. Usuário faz login pela primeira vez via Google.
2. Se o site tem a aprovação manual **ligada**: registro é criado com status `pending`; um `admin` aprova; só então o usuário recebe um papel (`member` por padrão, ou outro atribuído manualmente).
3. Se o site tem a aprovação manual **desligada**: usuário recebe o papel padrão configurado (ex: `member`) automaticamente no primeiro login, sem etapa de aprovação.

### Bootstrap de superadmin
Se nenhum `superadmin` existir ainda no banco, o próximo usuário a se registrar pula `pending` e o papel padrão — recebe `superadmin` diretamente, independente de `registrationApprovalRequired` estar ligado. Resolve o mesmo problema pelas duas pontas: instalação nova nunca fica travada esperando um admin que não existe pra aprovar o primeiro usuário, e sempre existe alguém pra conceder o resto das permissions depois. Para uma instância já com usuário criado mas sem superadmin (situação de migração, não instalação nova), um script (`scripts/bootstrap-superadmin.mjs`, mesmo padrão dos scripts de seed já existentes) promove um usuário existente por email — rodado manualmente, uma vez, fora do fluxo automático.

### Fora do escopo desta v1
- Login por senha única (OTP) enviada por email — entra como um segundo provider no futuro, sem alterar o modelo de identidade.

### Exceção conhecida à regra de `store.ts`
O `DrizzleAdapter` do Auth.js escreve diretamente nas tabelas `users`/`accounts`/`sessions` (via `events.createUser` e o próprio ciclo de login), sem passar por um `store.ts` do context de auth. Isso é esperado — é assim que o adapter do Auth.js funciona — e não deve ser "corrigido" para forçar passagem por `store.ts`, sob risco de quebrar o fluxo de login. É a única exceção documentada à regra de acesso a dado exclusivamente via `store.ts`.

## Modelo de RBAC

### Papéis
Existe um pequeno conjunto de papéis de sistema, fixos e não deletáveis, que garante que sempre exista quem administra a plataforma:

| Papel (nome interno) | Alias de exibição | O que é | Escopo |
| --- | --- | --- | --- |
| `superadmin` | Overlord | Dono da instância / quem instalou. Acesso irrestrito. Não pode ser removido do sistema. | — (ignora escopo) |
| `admin` | Administrador | Opera todas as seções do site. "Admin de seção" (Admin do Academy, Admin Editorial…) = **papel custom** com o subconjunto de `*.manage` da seção — não há `scopeType` de seção. | Global |
| `editor` | Editor | Modera um ou mais setores editoriais, **vinculado a categoria(s) do CMS**. Coordena autores. Não enxerga categoria não atribuída. | Por categoria do CMS |
| `author` | Autor | Cria e edita nas categorias atribuídas, **só rascunho — não publica**. | Por categoria do CMS |
| `member` | Membro | Consumidor autenticado. Sem acesso administrativo. | — |

Além desses cinco, qualquer site pode criar **papéis customizados** (novo `key`, novo nome) e atribuir a eles qualquer combinação de permissions do catálogo — é assim que se resolve o caso de "editor que gerencia todo o CMS" vs "editor menor" com escopo mais restrito.

`remove-role-from-user` recusa remover o papel `superadmin` de um usuário se isso deixar o sistema com zero superadmin — mesmo o próprio superadmin tentando remover a si mesmo. Sem essa checagem, o sistema reabre o mesmo deadlock que o bootstrap resolve, sem nenhum aviso na hora.

### Permissions
- Nomeadas por namespace: `dominio.recurso.acao` (ex: `cms.entries.manage`, `birthdays.read`).
- Cada `context` do core declara suas próprias permissions; cada plugin declara as suas via manifesto (seção "Sistema de plugins").
- Um usuário pode ter mais de um papel atribuído; suas permissions efetivas são a união das permissions de todos os papéis atribuídos a ele — sem hierarquia implícita entre papéis (um papel não "herda" de outro automaticamente).

Permission com escopo dentro de um recurso (ex: "editor restrito à(s) categoria(s) X do CMS", e não ao CMS inteiro) tem documento de design próprio, aprovado e faseado: **`docs/rbac-scoped-roles.md`** — **fases A–D concluídas (2026-08-28)**. Escopo mora em `rbac.role_assignment_scopes` (vínculo usuário × papel), `authorizeActor` ganhou 2º parâmetro `scope?` + `resolveScope`, e o CMS aplica o recorte por categoria nos `service.ts` de escrita de entries/categorias. A Fase D revisou a modelagem de "admin de seção": é papel custom, não um `scopeType admin.section` (único `scopeType` é `cms.category`).

## Cache

Para esta v1, cache fica em processo (memória da própria aplicação), sem Redis ou serviço externo — mas com regras para não repetir o problema de desempenho sentido no protótipo:

- Cache in-memory tem TTL curto e explícito por tipo de dado (ex: navegação resolvida, catálogo de RBAC) — nunca cache "para sempre" sem invalidação.
- Dado que muda por ação de usuário (ex: publicar uma entry) invalida o cache daquele dado no fim da própria `service` que fez a mudança — invalidação é responsabilidade de quem escreve, não um job de limpeza separado tentando adivinhar o que mudou.
- Nada que é específico de um único usuário (permissions do ator, sessão) deve ir para esse cache compartilhado.

## Observabilidade

O problema de desempenho que você sentiu no protótipo tem uma causa concreta e localizada: cada chamada de log e cada passo de trace disparava um `INSERT`/`UPDATE` no Postgres, um por vez, de forma síncrona ao fluxo da aplicação. Isso significa uma escrita no banco por log e por passo de trace — sob carga, isso pesa.

Regras para a v1 nova:
- Log e trace acumulam em buffer em memória primeiro; a escrita em banco acontece em lote, por um processo periódico (ex: a cada N segundos ou X entradas acumuladas), nunca um `INSERT` por chamada de log individual.
- Log mínimo obrigatório por use case: início e fim da execução do `handler`, com resultado (sucesso/erro), ator, e duração — isso já é suficiente pra reconstruir "o que aconteceu" sem logar cada passo interno do `service`.
- Nível `info` de operações de leitura pura (`get*`, `list*`, `find*`) não é obrigatório por padrão — só entra no log se for uma operação de escrita ou se falhar. Isso evita volume alto de log sem valor de diagnóstico.
- Trace (linha do tempo de uma requisição) é opcional e amostrado (ex: 1 a cada N requisições, ou só quando um erro acontece), não obrigatório em 100% do tráfego.

## Ainda não coberto neste documento
- Estratégia de teste (Vitest) por camada — o que cada tipo de teste precisa provar.
- Segurança: rate limiting, auditoria de ações sensíveis, acesso a arquivos de mídia.