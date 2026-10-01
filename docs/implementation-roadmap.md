# Roadmap de implementação — pós-revisão de `docs/issues.md` (2026-08-03)

Este documento organiza em ordem de implementação os itens registrados em `docs/issues.md`
(backlog original + notas adicionadas em 2026-08-03), com as decisões já tomadas e o contexto de
código levantado para cada um. Números entre parênteses (`R1`, `C5`, etc.) referenciam os mesmos
IDs usados na conversa que originou este documento.

> **Nota (2026-09-30):** desde 2026-09-02 os plugins (academy, birthdays, broadcast, company-metrics,
> donations, helpdesk…) não moram mais em `src/plugins/` — cada um tem repositório próprio
> (`venore-plugin-*`) e entra numa instância como pacote `@venore/plugin-*`. Caminhos
> `src/plugins/<nome>/...` citados abaixo referem-se a esses repositórios. Divergências conhecidas
> entre este documento e o código: `AGENTS.md` §7 (Known Gaps).

## Decisões já tomadas (não reabrir)

1. **R1 é prioridade imediata** — bug de segurança, tratado antes do resto.
2. **Tipo de conteúdo vira tag.** Um conteúdo pode ter mais de uma tag (N:N). Categoria continua
   exatamente como está — define a rota pública e agrupa conteúdo (1 categoria por conteúdo).
3. **G1 (ativar/desativar plugin) e PL1 (instalar via `.zip`) são a mesma frente de trabalho** —
   tratar como um workstream único de "ciclo de vida de plugin", não dois itens separados.
4. **C5 (estados de conteúdo) é pré-requisito** de C4, C6, A3, BL1 e P3 — vai antes deles na
   ordem de implementação.

## Como ler as fases

As fases abaixo são **sequenciais dentro de si**, mas as fases 5 (Temas) e 6 (Papéis — só o P1) são
**tracks independentes** — não dependem de nada nas fases 1–4 e podem ser puxadas em paralelo por
quem tiver disponibilidade, sem esperar o CMS/Editorial terminar.

---

## Fase 0 — Segurança (agora) — ✅ CONCLUÍDA

### R1 — Gate de aprovação de registro não está bloqueando ninguém — ✅ CONCLUÍDA

Implementado: `get-post-login-destination.ts` agora checa `getCurrentUserRegistrationStatus()` e
manda `pending` pra `/pending-approval` antes de decidir `/admin`/`/`; `(platform)/layout.tsx`
ganhou o mesmo gate pra qualquer navegação/refresh subsequente (não só o primeiro login);
`/pending-approval` migrou de `(platform)` pra `(auth)` (evita loop de redirect e chrome de Shell
desnecessária pra quem ainda não foi aprovado).

**O que é:** usuários novos são "registrados direto", mesmo com a aprovação de admin
teoricamente ligada.

**Causa raiz confirmada (não é suposição):**
- `src/contexts/auth/auth.config.ts` → evento `createUser` do Auth.js chama
  `handleUserRegistered` corretamente.
- `src/platform/registration/handle-user-registered.ts` está correto: checa
  `superadminExists()`, lê a setting `auth.registration_approval_required` via
  `isApprovalRequired()`, e chama `provisionUser` (marca `status = "pending"`) quando aprovação é
  exigida.
- `src/contexts/auth/features/identity/provision-user/service.ts` marca `pending` corretamente.
- A página `src/app/(platform)/pending-approval/page.tsx` **existe**.
- **O que falta:** não existe `middleware.ts` no projeto, e nenhum `layout.tsx` sob `src/app/`
  checa `session`/`status` do usuário. Ou seja: o usuário é marcado `pending` no banco, mas nada
  no app impede esse usuário de navegar normalmente — a página de espera nunca é alcançada porque
  nada redireciona pra ela.

**O que implementar:** um ponto de enforcement (mais provável: `middleware.ts` na raiz, ou um
layout guard em `src/app/(platform)/layout.tsx`) que lê a sessão, busca o `status` do usuário
(via `get-current-user-registration-status`, que já existe e já é usado em
`src/contexts/cms/menu-resolution.ts` — então o dado já está exposto, só falta o consumidor que
bloqueia) e redireciona `pending` para `/pending-approval`, deixando passar o resto.

**Complexidade:** baixa/média — a infraestrutura de dado já existe, é só fechar o buraco de
enforcement.

---

## Fase 1 — Correções rápidas independentes (sem dependência entre si) — ✅ CONCLUÍDA (H2/B1/T1)

| Item | O que é | Status |
|---|---|---|
| H2 | `/home` vira rota inicial (H1, comportamento esperado) mas o conteúdo não renderiza nela | ✅ `(platform)/page.tsx` não buscava `getEntryComposition` — só `getEntryBody`. Corrigido pra espelhar `[...slug]/page.tsx` |
| B1 | Breadcrumb não atualiza em troca de rota, só em troca main-nav/admin-nav | ✅ Causa raiz: layout único nunca re-renderiza em navegação client-side (partial rendering do App Router); nav-mode só "funciona" por ser Server Action (auto-refresh do Next). Adicionado `RouteChangeRefresher` (client, `usePathname`+`router.refresh()`) em `(platform)/layout.tsx` |
| T1 | Travadinha na transição de colapso do sidebar (Venore Slime **e** Menonitas Classic) | ✅ Causa raiz: toggle era `<form action={onToggleCollapsed}>` só-servidor — clique esperava round-trip antes da classe de largura mudar. `SidebarLeftSlot` virou client com `useState` local (instantâneo) + `startTransition` pra persistir cookie em background, nos dois temas |
| T5 | Faltam tokens de background/foreground do slot **footer** | 🔴 Pendente — não fizemos ainda |

---

## Fase 2 — Fundação de modelo de dado (bloqueia a Fase 3 inteira) — ✅ CONCLUÍDA

Migrations `drizzle/0022_cms_tag_junction_and_entry_status.sql` (cria `entry_content_types`,
`visibility`, `scheduled_publish_at`, `scheduled_archive_at`, checks de status/visibility, e um
backfill manual de `entries.content_type_id` pro junction) e
`drizzle/0023_cms_drop_entry_content_type_id.sql` (derruba a coluna antiga). Geradas em duas
etapas porque `drizzle-kit generate` pede prompt interativo (rename vs. create) quando a mesma
tabela ganha e perde coluna no mesmo diff — sem TTY disponível na sessão, resolvido separando
"só adiciona" (sem prompt) de "só remove" (sem prompt) em vez de responder o prompt.

**Desvio deliberado do plano original:** a tabela física continua se chamando `content_types` (só
a cardinalidade virou N:N) — o rename de vocabulário pra "tag" em tela/rota/permission
(`cms.content-types.manage`, `/admin/cms/content-types`) fica pra Fase 3, junto do rename CMS →
"Editorial", pra não relabelar duas vezes. `EntryRecord.contentTypeIds: string[]` já reflete o
conceito de tag no código; só o nome de arquivo/rota/tabela ainda diz "content type".

**Também implementado, além do que estava descrito abaixo:** dois use cases novos —
`schedule-entry` (rascunho/agendado → agendado, com `scheduledPublishAt` obrigatório no futuro) e
`archive-entry` (arquivamento manual) — e a varredura automática `cms/scheduling.ts`
(`processScheduledEntries`, mesmo padrão de `setInterval`+dedupe global de
`observability/retention.ts`, auto-inicia ao importar o barrel do `cms`). Simplificação aceita:
a transição automática (via varredura) **não** roda a validação de blocos não configurados que
`publish-entry` roda numa publicação manual — importar `platform/page-builder` de dentro de
`contexts/cms` inverteria a hierarquia de dependência (regra 12). Registrado como gap aceito no
código, não escondido.

### Tag (ex-tipo de conteúdo) — decisão #2

**Estado atual confirmado** (`src/contexts/cms/database/schema/index.ts`):
```ts
export const entries = cmsSchema.table("entries", {
  contentTypeId: text("content_type_id").notNull().references(() => contentTypes.id, { onDelete: "restrict" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  ...
```
Hoje é **1 tipo de conteúdo por entry** (FK `notNull`, sem tabela de junção). `categoryId` já é
nullable e independente — não precisa mudar.

**O que implementar:**
1. Tabela de junção `entry_tags` (`entryId`, `tagId`), N:N.
2. Migrar `content_types` → conceito de `tags` (avaliar se renomeia a tabela ou só o vocabulário
   de aplicação por cima — renomear tabela via `drizzle-kit generate` é mais limpo a longo prazo,
   mas mexe em toda a feature `src/contexts/cms/features/content-types/*`).
3. `entries.contentTypeId` sai do schema de `entries`; passa a ser lido via `entry_tags`.
4. Toda a cadeia `handler → service → store` de `content-types` (create/list) e de `entries`
   (que hoje recebe `contentTypeId` singular) muda assinatura para `tagIds: string[]`.
5. Migration via `drizzle-kit generate` (nunca editar `_journal.json` manualmente, regra do
   `AGENTS.md` seção 6.5).

**Complexidade:** alta — muda schema de um core context (`cms`) e a assinatura pública usada por
quem cria/edita conteúdo. Fazer **antes** de qualquer item da Fase 3 que toque em tipo de
conteúdo/tag.

### C5 — Estados de conteúdo (Rascunho / Publicado / Agendado / Arquivado)

**Estado atual confirmado:** `entries.status` já existe como `text` com default `"draft"`, mas o
comentário no schema diz explicitamente que só `"draft" | "published"` são usados hoje
(`contracts/types.ts`). "Agendado" e "Arquivado" não existem em lugar nenhum.

**O que implementar:**
1. Expandir o enum de status em `contracts/types.ts` e validação de handler/service para os 4
   estados.
2. Campos novos em `entries` para agendamento: quando publicar / quando arquivar
   (`scheduledPublishAt`, `scheduledArchiveAt` ou equivalente).
3. **Mecanismo de execução do agendamento** — hoje não existe nenhum worker/cron no projeto para
   isso. É a peça de infraestrutura nova mais sensível deste item: precisa de um job periódico
   (mesmo princípio de "acumula e processa em lote" do AGENTS.md seção 2, mas aqui é
   scheduler, não buffer de log) que transiciona `scheduled → published` / `published → archived`
   nos horários definidos.
4. Regra de transição: só `archived` pode ser deletado definitivamente (C6), com confirmação na
   UI.

**Complexidade:** alta — é o item de infraestrutura mais novo (scheduler não existe hoje) e é
pré-requisito direto de C4, C6, A3 (adaptado), BL1, P3.

### C7 — Privacidade por conteúdo (aberto vs. fechado)

Campo simples em `entries` (ex: `visibility: "public" | "authenticated"`), resolvido no mesmo
ponto de leitura pública de entry. Fazer junto da Fase 2 porque BL2 (blogroll pública de vagas em
site fechado) depende dele.

**Complexidade:** média.

---

## Fase 3 — CMS → "Editorial" (consome a Fase 2) — ✅ CONCLUÍDA (itens 1–8)

| Ordem | Item | Status |
|---|---|---|
| 1 | C1 — botão de criação no topo, padronizado em tags/categorias/conteúdos/navegação | ✅ Menus e Conteúdos já tinham o padrão (botão no topo); Tags e Categorias migraram do form inline pro mesmo `Dialog` de `CreateMenuDialog` |
| 2 | C2 — tabela shadcn com filtro + busca por nome | ✅ `ContentTypesTable`, `CategoriesTable`, `EntriesTable` (busca + filtro de status + filtro de tag) — 3 componentes próprios, não um genérico único (colunas/ações diferentes demais pra valer a abstração) |
| 3 | C3 — botão "ver página ao vivo" em Conteúdos | ✅ Só aparece quando `status === "published"`; resolve `/<slug>` ou `/<categoria>/<slug>` a partir do dado já carregado na página, sem novo helper de contexto |
| 4 | C4 — ações de estado na UI | ✅ Não virou um `<select>` livre (agendar exige uma data, não dá pra modelar como opção simples) — botões contextuais por status: draft → Publicar/Agendar; scheduled → Publicar agora; published → Arquivar; archived → Excluir |
| 5 | C6 — deletar definitivamente só se `archived`, com confirmação | ✅ Use case novo `delete-entry` (não existia) + `DeleteEntryDialog` (confirmação via Dialog, não `window.confirm`) |
| 6 | Renomear "Conteúdos"/CMS → "Editorial" na navegação/admin | ✅ Rótulos (nav, breadcrumb, títulos de página, grupo de permissões no `/admin/rbac`) — rotas/permissions internas (`cms.*`, `/admin/cms/*`) continuam iguais, só o texto visível mudou. "Tipos de conteúdo" também virou "Tags" nos rótulos, fechando o rename de vocabulário que a Fase 2 tinha deixado só no código |
| 7 | C8 — contagem de conteúdos por categoria/tag + dashboard | ✅ `listCategories`/`listContentTypes` passaram a devolver `entryCount` (left join + count + groupBy, mesmo padrão de `findAllMenusWithItemCount`/`itemCount` que `list-menus` já usava) — não uma segunda query por linha. `EditorialDashboard` em `/admin/cms`: tiles de status (draft/scheduled/published/archived) + top 5 categorias/tags por `entryCount` + top 5 mais acessados |
| 8 | C9 — contador de acesso por conteúdo | ✅ `viewCount` em `entries`, incrementado só em lote — nunca por request. `cms/view-tracking.ts` acumula em `Map<entryId, incremento>` e flusha a cada 30s (`setInterval`+dedupe global, mesmo padrão de `observability/retention.ts` e `cms/scheduling.ts`) — o que a home e a rota catch-all chamam (`recordEntryView`) é síncrono e não toca banco |

**Desvio do plano original:** a nota anterior deste documento descrevia C8/C9 como "sessão própria,
não continuação direta" por causa do risco de performance de um contador por request. Resolvido
reaproveitando o padrão de buffer+flush que já existia em `observability/` (a mesma técnica que
`AGENTS.md` §2 já prescreve pra log) — não foi necessário inventar mecanismo novo nem uma tabela de
eventos separada; um único `viewCount` incremental em `entries` foi suficiente pro pedido ("contador
de visitas"). Contagem por categoria/tag também não exigiu tabela nova — só o join que `list-menus`
já fazia pra `itemCount`, replicado.

**Limitação aceita, documentada no código:** o buffer de `view-tracking.ts` é em memória de
processo — em deploy serverless/múltiplas instâncias, cada processo tem o próprio buffer e visitas
podem se perder se o processo morrer antes do próximo flush (mesma ressalva já aceita pra
`scheduling.ts`/`retention.ts`/`flush.ts`).

---

## Fase 4 — Itens que consomem a Fase 2/3 mas são módulos à parte — ✅ CONCLUÍDA

| Item | O que é | Status |
|---|---|---|
| BL1 | Rota de categoria (`/cursos`) lista conteúdo em formato blog, respeitando status | ✅ `[...slug]/page.tsx`: 1 segmento agora tenta categoria primeiro (`listEntries({categoryId})`, já só devolve `published`), cai pro lookup de entry raiz se não for categoria. Decisão registrada: categoria tem precedência sobre entry raiz de mesmo slug (não há constraint de banco proibindo colisão entre as duas — não impedia antes, continua não impedindo, só a ordem de resolução ficou determinística). Visibilidade (C7) filtrada por item antes de listar, não como link que ia dar 404 |
| BL2 | Blogroll pública ("Vagas de Emprego") mesmo em site fechado a membros | ✅ Resolvido por decisão — "site fechado" não existe como conceito hoje (confirmado por investigação); C7 (`entries.visibility`) já cobre "esta categoria/conteúdo fica aberto" sem trabalho novo. "Site fechado a visitante anônimo" registrado como possível item de backlog futuro, não parte desta fase |
| P3 | Autor só cria draft, não publica | ✅ Nova permission `cms.entries.publish` (separada de `cms.entries.manage`), exigida por `publish-entry`/`schedule-entry`. `authorizeActor` ganhou suporte a lista de permissions (OR, não AND) pra isso — quem já tinha `cms.entries.manage` continua publicando sem precisar da nova permission, então papéis existentes (admin/superadmin) não regridem. `create-entry`/`update-entry` continuam só sob `cms.entries.manage` |
| M1/M2/M3 | Sistema de mídia | ✅ Concluído — ver detalhamento abaixo |

### M1/M2/M3 — migração completa de `files` (disco local) para `assets`+Vercel Blob

**Desvio de escopo, a partir de decisão do usuário:** a investigação revelou que o sistema de
mídia real (`files`, usado por `/admin/media`, avatar, page-builder) só funcionava com storage em
disco local (`LocalStorageAdapter`) — inviável em produção serverless. Existia em paralelo um
segundo sistema (`assets`+`StoragePort`, do `docs/media/blob-spec.md`) já com suporte a Vercel
Blob real, mas sem nenhuma UI conectada. Decisão: descontinuar `files` inteiramente e portar tudo
pra `assets`, adotando o formato novo (`MediaAsset`) em vez de manter uma fachada de compatibilidade.

**O que foi feito:**
- `assets` ganhou de volta `filename` (nome original) e `categoryId` (nullable, reaproveitando a
  tabela `media.categories` que já existia) — nenhum dos dois estava no desenho original do
  blob-spec.
- `MediaVisibility` virou 3 estados: `public` / `restricted` / `private`. **"Restricted" é hoje só
  rótulo administrativo** — o enforcement de "só consumível no contexto de origem" não foi
  implementado (ambíguo demais pra adivinhar sem mais especificação: exigiria a UI de consumo
  saber "contexto atual" e comparar contra a categoria do asset). Registrado como Known Gap.
- Categoria reservada "avatars" — auto-criada e atribuída no primeiro upload de avatar (`M1`,
  primeiro caso concreto de "pasta de sistema").
- `reconcileOrphanUploads` (`M2`) — mesmo padrão de scheduler (`setInterval`+dedupe global) já
  usado 3x no projeto (`observability/retention.ts`, `cms/scheduling.ts`, `cms/view-tracking.ts`).
- Todos os ~20 consumidores fora do context de mídia (avatar, capa de curso/aula do academy, logo
  da marca, blocos do page-builder, mídia de entry do CMS) portados de `getMedia`/`.mimeType` pra
  `getMediaAsset`/`.contentType`.
- Migration (`drizzle/0025_media_assets_only.sql`) inclui backfill manual dos 4 uploads que já
  existiam em `files` neste banco de dev — preservados em `assets` (com um checksum-placeholder,
  já que o conteúdo real do arquivo não estava disponível pro script de migration) — e um `UPDATE`
  reconciliando `auth.users.avatar_media_id` pros novos ids. Nenhum dado foi perdido na migração.
- `StorageAdapter`/`LocalStorageAdapter`/`features/files/*` apagados por completo.

**Não incluído nesta passada (fora de escopo, não esquecido):**
- UI de upload direto client→Blob (o par ticket+confirmação já existe no domínio, usado hoje só
  pelo harness de teste em `/admin/media/upload-test`) — o formulário real de `/admin/media`
  continua enviando o arquivo inteiro pro servidor (`uploadMediaAsset`, server-buffered), que já
  resolve "sair do disco local", mas não o limite de ~4.5MB de body de uma function.
- Enforcement de "restricted" (acima).
- `purgeMediaAsset`/`sweepSoftDeletedMedia` (hard delete definitivo após soft delete + janela de
  graça) — `deleteMediaAsset` já faz soft delete; o sweep periódico que purga de vez não foi
  implementado.

---

## Fase 5 — Temas (track independente, pode rodar em paralelo com 2–4)

| Ordem | Item | Complexidade | Observação |
|---|---|---|---|
| 1 | T2 — config estética do brand (ex: tamanho da logo) migra de `settings` pro tema | Média | Hoje vem de `getBrandConfig()` via setting — mudar de fonte de dado, não só de tela |
| 2 | T4 — settings de comportamento de header/sidebar no Venore Slime | Média | Escopo exato ("comportamento") ainda não especificado — validar com o usuário antes de estimar em detalhe |
| 3 | T3 — subsistema de paletas de cor salváveis pelo admin/designer | Alta | Tensiona com a regra do `AGENTS.md` seção 3 de que só `theme.css` declara token de design — precisa de um mecanismo de paleta-como-dado, não CSS estático. Maior item da fase |

---

## Fase 6 — Ciclo de vida de plugin (G1 + PL1 unificados — decisão #3)

**Bloqueio arquitetural comum, já documentado em G1:** plugins são importados estaticamente em
`src/plugins/registry.ts` porque o Next.js exige resolução em build-time para bundling. Isso
afeta os dois pedidos:

- **G1** — ativar/desativar plugin persistido: mesmo "desativado", o plugin continua fisicamente
  no bundle.
- **PL1** — instalar/desinstalar via `.zip`: um plugin instalado depois do build não teria como
  entrar no bundle sem rebuild/redeploy.

**O que implementar (uma única investigação, não duas):** avaliar se dá para sair do import
estático para um sistema de resolução em runtime (nota do próprio G1: é o que o `fem-colaborador`
original tinha) — isso é pré-requisito real de G1 e PL1 ao mesmo tempo. Sem resolver isso, os
dois pedidos viram apenas "flag visual de ativo/inativo" sem efeito real, o que já foi
identificado como de baixo valor prático.

- **PL2** (perguntar se limpa banco ou só apaga pasta ao desinstalar) — depende de PL1.

**Complexidade:** alta — é a mudança de infraestrutura mais arriscada do roadmap inteiro
(contraria uma exigência do próprio framework).

---

## Fase 7 — Academy (desacoplamento + produto)

| Ordem | Item | Depende de | Complexidade |
|---|---|---|---|
| 1 | A1 — aulas param de depender de conteúdo pré-publicado do CMS | — | Alta — reverte acoplamento atual, checar quanto do Academy hoje usa `entries` do CMS antes de estimar |
| 2 | A2 — aulas não contam como Conteúdo, não aparecem fora do Academy | A1 | Média (consequência direta) |
| 3 | A3 — status de Curso/Aula: Público / Restrito / Rascunho | C5 (padrão, não reaproveita o enum) | Média |
| 4 | A4 — dashboard do curso (progress bar, agenda, card de aproveitamento, tabela de aulas) | A1–A3 | Alta — reaproveita padrão do card de aniversariantes já existente |
| 5 | A5 — página de aula: rota de leitura por capítulo, material complementar, gate de avanço (quiz/checklist) | A1–A4 | Alta — maior item de produto do roadmap, é essencialmente construir um LMS |

---

## Fase 8 — Import/Export

| Item | Depende de | Complexidade |
|---|---|---|
| IE1 — import/export CMS + MMS (migração de site) | Tag/C5 estáveis (Fase 2) | Alta — ✅ CONCLUÍDA |
| IE2 — import/export próprio do Academy | A1 (Academy desacoplado do CMS) | Alta — bloqueada: A1 ainda não está estável (typecheck do plugin academy falhando nesta sessão) |

### IE1 — ✅ CONCLUÍDA

Novo context `src/contexts/import-export/` (não `platform/`: nada aqui evita ciclo entre contexts
já existentes, então é composição normal via barrel de `cms`/`media`/`auth`, mesmo padrão de
`cms` já depender de `media`).

- **Formato**: `.zip` (`fflate`, dependência nova) com `manifest.json` + `assets/<checksum>-
  <filename>`. Toda referência cruzada no manifest é por key/slug/checksum, nunca por id de banco
  — `ExportManifest` em `contracts/types.ts` documenta cada `ref`.
- **Escopo** (confirmado com o usuário): CMS (tags, categorias, entries incl. composição de
  blocos, menus) + biblioteca de mídia inteira (não só mídia referenciada). RBAC e Settings ficam
  de fora — são configuração de ambiente, não conteúdo migrável.
- **Mídia**: assets são baixados e embutidos no `.zip` (não só metadata/URL — sobrevive de fato a
  troca de storage/domínio). Import dedupe por checksum (reaproveita se já existir no destino).
- **Conflito no import**: pular e reportar — nunca sobrescreve, nunca aborta o pacote inteiro por
  uma linha ruim (best-effort por entidade, ver `ImportReport`).
- **Limitação conhecida (arquitetural, não contornável sem quebrar regra 14/camadas)**: não existe
  API pública para setar `authorId` de uma entry a alguém que não seja o ator autenticado
  (`createEntry` sempre atribui ao `actorId` da sessão). Import mapeia `authorEmail` por email só
  para fins de relatório — a entry importada sempre fica atribuída a quem rodou o import.
- **Limitação conhecida (infra)**: rota de import (`POST /api/import-export/import`) usa upload
  direto (não Server Action, por causa do limite de 10mb de `serverActions.bodySizeLimit`), mas
  ainda está sujeita ao limite de payload da plataforma de hospedagem — pacote muito grande (muito
  vídeo) pode esbarrar nisso, mesma razão pela qual upload de mídia grande já usa client-upload
  direto ao Blob em vez de rota server-buffered.
- Permission: reaproveita as 5 já existentes (`cms.content-types.manage`, `cms.categories.manage`,
  `cms.entries.manage`, `cms.menus.manage`, `media.manage`) — todas ao mesmo tempo (AND, não OR),
  gate próprio em `IMPORT_EXPORT_REQUIRED_PERMISSIONS` porque `authorizeActor` só sabe fazer OR.
  Nenhuma permission nova no catálogo do RBAC.
- Tela: `/admin/import-export` (nav item `import-export.overview`, grupo "Editorial").

### IE2 — bloqueada

Não iniciada nesta sessão: `src/plugins/academy` ainda importa `@/contexts/cms` em ~23 arquivos e
o typecheck do plugin está falhando neste momento (erros em `LessonRecord`/`cmsEntryId`,
independentes deste trabalho — sinal de que A1 está em andamento em paralelo, não estável). Import
próprio do Academy fica pra depois de A1 fechar e o typecheck voltar a passar.

---

## Track independente — Papéis e Permissões

| Item | Depende de | Complexidade | Observação |
|---|---|---|---|
| P1 — aliases de exibição para roles (Overlord, Administrador, Editor, Autor, Membro) mantendo nome interno | — | Baixa/média | RBAC já suporta roles customizadas — é só um campo de label de exibição por role. Pode ser feito a qualquer momento |
| P2 — Editor vinculado a categoria específica, sem acesso às demais | — | Alta | **Não é item novo** — é o mesmo gap já registrado no `AGENTS.md` seção 7 ("permission com escopo dentro de um recurso"), documentado como em aberto no documento de arquitetura |

---

## Resumo da ordem geral

```
Fase 0 (R1 — segurança, agora)
   ↓
Fase 1 (bugs independentes — pode rodar em paralelo com tudo)
   ↓
Fase 2 (Tag + C5 + C7 — fundação de dado, bloqueia Fase 3)
   ↓
Fase 3 (Editorial/CMS) → Fase 4 (Blogroll, mídia, autor-draft)
   ↓                           ↓
Fase 8 (Import/export CMS/MMS)  ↓
                                Fase 7 (Academy — A1 primeiro desbloqueia o resto)
                                   ↓
                                Fase 8 (Import/export Academy)

Tracks paralelos, sem dependência das fases acima:
- Fase 5 (Temas)
- Track Papéis (P1 solto; P2 é gap arquitetural já conhecido, não uma feature nova)
- Fase 6 (ciclo de vida de plugin — G1+PL1) pode começar a investigação a qualquer momento,
  mas é trabalho de infraestrutura isolado do resto
```
