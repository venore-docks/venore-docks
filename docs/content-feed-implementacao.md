# Feed de notícias entre sites — plano de implementação

Status: **proposta, não iniciada** (2026-10-01). Cenário de referência: as notícias publicadas no
**portal do colaborador** (`fem-colaborador.vercel.app`, branch `portal-colaborador`) aparecendo
nas demais instâncias (vanilla, nestpro, erasto-league…).

## 1. Onde estamos

O context `content-feed` já existe e o endpoint do publicador está no ar (`GET
/api/content-feed/articles` responde 401 sem chave no portal). Mas, como produto, **não funciona**:

| # | Problema | Onde |
| --- | --- | --- |
| 1 | Nenhuma sincronização automática — só o botão "sincronizar" no admin | `platform/scheduled-jobs/core-jobs.ts` não tem job de content-feed |
| 2 | Nada exibe os artigos sincronizados no site assinante (nem bloco, nem página) | `listArticles` só sai pelo SDK de plugin |
| 3 | Despublicar/arquivar/tornar privado/tirar a categoria da conexão nunca chega ao assinante | o publicador só devolve o que é elegível; ninguém remove |
| 4 | Cursor `since` = relógio do **assinante**, gravado depois da resposta — perde artigos (corrida/relógio) e nunca traz o antigo quando a categoria muda | `sync-source/service.ts` (`lastSyncedAt = new Date()`) |
| 5 | Sem paginação; primeiro sync traz tudo e faz um `getMediaAsset` por entry (N+1) | `list-articles-for-connection/service.ts` |
| 6 | Assinante digita `category keys` à mão, mas a tela do publicador só mostra o nome da categoria; key errada filtra tudo em silêncio | `admin/content-feed/page.tsx` |
| 7 | URL de capa relativa (driver `filesystem`) quebra no assinante | `resolveCoverImageUrl` |
| 8 | Sem edição de fonte na UI (o `updateSource` existe no barrel, não tem action) | `admin/content-feed/actions.ts` |
| 9 | Sem proteção contra apontar o fetch pra host interno (SSRF) nem exigência de HTTPS | `create-source/handler.ts` |
| 10 | Nenhuma instância tem conexão/fonte configurada hoje | conferido nos bancos em 2026-10-01 |

O que fica como está (já é bom): chave por conexão comparada em tempo constante, rate limit por IP
e por chave, só entries `published` + `public` + sem `internalOwner`, upsert por
`(source_id, remote_ref)`, link "leia mais" montado no assinante a partir dos slugs.

## 2. Decisões de desenho

### D1 — Contrato v2 do endpoint, compatível com o v1

`GET /api/content-feed/articles` ganha parâmetros **opcionais** (assinante antigo, sem eles,
continua recebendo exatamente o que recebe hoje):

| Parâmetro | Efeito |
| --- | --- |
| `cursor` | Opaco, devolvido pelo próprio publicador (`base64("<updatedAt ISO>|<entryId>")`). Ordenação estável por `(updated_at, id)` — empate de `updated_at` não perde nada. Substitui `since`. |
| `limit` | 1–100 (default 50). |

Resposta v2 (campos novos são aditivos):

```json
{
  "articles": [ { "ref": "...", "title": "...", "...": "..." } ],
  "nextCursor": "MjAyNi0xMC0wMVQxMjowMDowMC4wMDBafGFiYw==",
  "hasMore": false,
  "allowedCategoryKeys": ["noticias", "institucional"],
  "feedVersion": 2
}
```

- O cursor vem do **publicador**, nunca do relógio do assinante (resolve o #4).
- `allowedCategoryKeys`: o que esta conexão libera hoje — o assinante usa pra detectar mudança de
  categoria e pra montar a tela (D6).
- Capa: o publicador passa a mandar **URL absoluta** e, quando houver, a variante de ~480 px
  (`coverImage: { url, width, height }`), buscadas em lote com `getMediaAssetUrls` (resolve #5 e #7).
  `coverImageUrl` continua no payload pro v1.

### D2 — Remoções por reconciliação de refs (sem tabela nova no publicador)

Novo modo `GET /api/content-feed/articles?refs=1`: devolve só a lista de `ref` elegíveis hoje
(`{ "refs": ["id1", "id2", ...], "feedVersion": 2 }`, ids apenas — barato). O assinante, ao fim de
um sync completo ou a cada N horas, apaga de `content_feed.articles` o que não está mais na lista.
Cobre de uma vez: despublicar, arquivar, tornar privado, apagar, mover de categoria e tirar a
categoria da conexão (resolve #3). Alternativa descartada: log de "tombstones" no publicador —
exige tabela e retenção nova pra resolver o mesmo problema.

### D3 — Ressincronização completa quando o filtro muda

O assinante guarda a impressão digital do filtro (`allowedCategoryKeys` do publicador + as
categorias escolhidas no assinante). Se mudou desde o último sync, zera o cursor e refaz do início
(resolve a parte de #4 sobre categoria adicionada depois). Editar as categorias da fonte também
zera.

### D4 — Sincronização automática pelo agendador do core

- Job novo em `CORE_SCHEDULED_JOBS`: `content-feed.sync-sources`, a cada **15 min**.
- Cada execução percorre as fontes cujo `last_attempt_at` passou do intervalo, com orçamento de
  ~40 s (o `/api/cron/tick` tem `maxDuration` 60): o que não couber fica pra próxima.
- Por fonte: segue `nextCursor` até `hasMore=false` (no máximo 10 páginas por execução), depois
  reconcilia refs (D2) no máximo a cada 6 h.
- `syncSource` passa a aceitar ator `system` (hoje exige `actorId` de usuário).
- **Pré-requisito operacional:** o cron precisa estar ligado nas instâncias assinantes
  (`CRON_SECRET` na Vercel + `CRON_TARGETS` no GitHub — `.github/workflows/cron.yml`). Sem isso,
  só o botão manual sincroniza. O botão continua existindo.

### D5 — Exibição: bloco do page-builder "Notícias de outros sites"

Bloco do core `core.content.feed` (leaf, permitido dentro de Section/Row), renderizado no
servidor a partir de `listArticles` (barrel de `contexts/content-feed`):

| Campo | Tipo | Default |
| --- | --- | --- |
| Fontes | multi-select das fontes cadastradas (vazio = todas) | todas |
| Categorias | multi-select das `categoryKey` já sincronizadas (vazio = todas) | todas |
| Quantidade | número 1–24 | 6 |
| Layout | `lista` / `grade` | grade |
| Mostrar | imagem, resumo, data, nome da fonte (checkboxes) | todos |
| Abrir em nova aba | booleano | não |
| Texto quando vazio | texto | "Nenhuma notícia por enquanto." |

- Cada item linka para a notícia **no site de origem** (`source.remoteUrl/categorySlug/entrySlug`).
  Não copiamos o corpo da notícia (ver §6).
- Cache curto (60 s) por combinação de filtros, invalidado ao fim de cada sync que mudou algo.
- Só tokens de tema (`bg-card`, `text-muted-foreground`…), mobile-first (AGENTS.md §3/§4).
- Opcional numa segunda etapa: uma rota pública `/noticias-parceiras` no catch-all do CMS.

### D6 — Telas do admin

- **Publicador ("Quem pode assinar")**: mostrar a `key` técnica ao lado do nome de cada categoria
  (é o que o assinante usa) e quantas notícias cada conexão expõe hoje.
- **Assinante ("De onde eu assino")**:
  - ao criar/editar fonte, botão **"Testar conexão"**: chama o publicador, mostra "OK — 12
    notícias, categorias: noticias, institucional" ou o erro (401 chave inválida, timeout…);
  - categorias escolhidas por **checkbox** a partir de `allowedCategoryKeys` (some a digitação
    manual — resolve #6);
  - **editar** fonte (nome, URL, chave, categorias) — liga o `updateSource` que já existe (#8);
  - status por fonte: último sucesso, último erro, nº de artigos, próximo sync.

### D7 — Segurança

- `remoteUrl` exige `https:` (exceto `localhost` com `NODE_ENV=development`).
- Recusa host que resolve para IP privado/loopback/link-local (SSRF), a menos que
  `CONTENT_FEED_ALLOW_PRIVATE_HOSTS=true` (rede interna de propósito).
- Resposta limitada a 5 MB e `limit` ≤ 100; JSON validado com Zod antes do upsert (campos com
  tamanho máximo: título 300, resumo 1000, URLs 2000).
- A chave segue em texto plano no banco (decisão original, blast radius limitado a conteúdo já
  público), mas a tela passa a ter **"Gerar nova chave"** (rotação) e auditoria
  (`recordAuditEvent`) de criar/rotacionar/apagar conexão.

## 3. Mudanças por camada

**Banco (migration do core, `drizzle-kit generate`):**

| Tabela | Coluna nova | Para quê |
| --- | --- | --- |
| `content_feed.sources` | `sync_cursor text` | cursor do publicador (D1) |
| | `filter_fingerprint text` | detectar mudança de filtro (D3) |
| | `last_attempt_at timestamptz` | agendamento do job (D4) |
| | `last_success_at timestamptz` | status na tela |
| | `last_reconciled_at timestamptz` | ritmo da reconciliação (D2) |
| `content_feed.articles` | `cover_image_width int`, `cover_image_height int` | capa sem layout shift |

`last_synced_at` fica (compatibilidade); passa a ser só "último sucesso" para exibição.

**`contexts/content-feed`:**

- `publisher/list-articles-for-connection`: cursor + limit + `refs=1` + capa em lote absoluta.
  O CMS precisa de um `listEntries` com ordenação `(updated_at, id)` e cursor — mudança pequena em
  `contexts/cms/features/entries/list-entries` (exposta pelo barrel, sem import interno).
- `subscriber/sync-source`: laço de páginas, fingerprint, ator `system`, Zod do payload.
- `subscriber/reconcile-source` (novo): `refs=1` + delete dos ausentes.
- `subscriber/test-source-connection` (novo): usado pelo "Testar conexão".
- `subscriber/sync-due-sources` (novo, sem ator): chamado só pelo job — comentário no barrel
  apontando para `platform/scheduled-jobs/core-jobs.ts` (regra 14).
- `list-articles`: filtros por fonte/categoria/limite para o bloco.

**`platform/`:** job em `core-jobs.ts`; definição + renderer do bloco em
`platform/page-builder/blocks/content-feed.ts` e `block-renderers.tsx`.

**`app/`:** `src/app/api/content-feed/articles/route.ts` (parâmetros novos, limites), actions de
editar/testar fonte e rotacionar chave em `admin/content-feed/actions.ts`, ajustes de tela.

## 4. Fases

| Fase | Entrega | Estimativa |
| --- | --- | --- |
| F1 | Contrato v2 (cursor, limit, refs, capa absoluta em lote) + sync com cursor do publicador + reconciliação + fingerprint + migration | 1–1,5 dia |
| F2 | Job agendado `content-feed.sync-sources` (orçamento de tempo, ator `system`) | 0,5 dia |
| F3 | Bloco "Notícias de outros sites" | 1 dia |
| F4 | Telas: testar conexão, categorias por checkbox, editar fonte, status, key visível no publicador, rotação de chave | 1 dia |
| F5 | Segurança (HTTPS, SSRF, limites, Zod) + auditoria | 0,5 dia |

Total: **4–4,5 dias**. F1+F2 já tornam o feed confiável; F3 é o que faz aparecer no site.

## 5. Testes

- Unitário (`service`/`handler`): paginação e cursor estável com empate de `updated_at`;
  reconciliação apaga só o ausente; fingerprint zera cursor; payload inválido não grava nada;
  SSRF/HTTPS recusados; job respeita orçamento e intervalo.
- Integração (`*.integration.test.ts`, Postgres real): publicador e assinante no mesmo banco,
  com o `fetch` do assinante chamando a rota do publicador em processo — publicar → sync →
  aparece; despublicar → reconciliação → some; categoria nova na conexão → ressincroniza o antigo.
- Render do bloco (`renderToStaticMarkup`): filtros, vazio, link para a origem, sem imagem.

## 6. Fora do escopo (decidir depois)

- **Copiar a notícia inteira** (corpo/composição) para uma página local no assinante: hoje o
  payload é título/resumo/capa e o link vai para a origem. Copiar exige trazer a composição de
  blocos e a mídia, e decidir quem é o "dono" das edições — não recomendado agora.
- **Copiar a imagem de capa** para o storage do assinante (hoje: hotlink da URL pública do
  publicador). Só se o publicador puder ficar fora do ar sem quebrar as capas.
- **Push (webhook) em vez de polling** — entra junto com o item "webhooks/tokens de API" da
  avaliação, quando existir.

## 7. Roteiro de teste com o portal do colaborador (depois da F1–F3)

1. No portal (`fem-colaborador.vercel.app/admin/content-feed` → "Quem pode assinar"): criar a
   conexão "Sites FEM", marcar a categoria `noticias`, copiar a chave.
2. Em cada assinante (ex: `venore-docks.vercel.app/admin/content-feed` → "De onde eu assino"):
   nova fonte com URL `https://fem-colaborador.vercel.app` e a chave → **Testar conexão** (deve
   listar `noticias`) → salvar → **Sincronizar agora**.
3. Numa página do assinante, adicionar o bloco "Notícias de outros sites" e publicar.
4. Publicar uma notícia nova no portal → aparece no assinante no próximo sync (≤15 min com o cron
   ligado, ou pelo botão).
5. Despublicar essa notícia no portal → some do assinante na reconciliação.

Conferência no banco do assinante:

```sql
SELECT name, remote_url, last_success_at, last_sync_error, sync_cursor IS NOT NULL AS has_cursor
FROM content_feed.sources;
SELECT title, category_key, published_at, fetched_at
FROM content_feed.articles ORDER BY published_at DESC NULLS LAST LIMIT 20;
```
