# Media Subsystem — Vercel Blob Storage Spec

`Status original: proposta de desenho — nenhum código, migration ou UI aplicados nesta sessão`
`Escopo original: contratos de tipo, schema e regras. Implementação era trabalho futuro.`

**Atualização (docs/implementation-roadmap.md, Fase 4/M1-M3): implementado.** `files`/
`StorageAdapter`/`LocalStorageAdapter` foram descontinuados — `media.assets`+`StoragePort` é
agora o único sistema de mídia, com todas as telas (admin/media, avatar, media-picker-field)
portadas. Diferenças em relação ao desenho original abaixo: `assets` ganhou de volta `filename`
(nome original, distinto de `pathname`) e `categoryId` (pra não perder a organização por
categoria/pasta que `files` tinha — seção 3 deste doc não previa nenhum dos dois);
`MediaVisibility` virou 3 estados (`public`/`restricted`/`private`) em vez de 2, com "restricted"
ainda sem enforcement de consumo (rótulo administrativo por ora, Known Gap registrado no
roadmap); `reconcileOrphanUploads` roda via `setInterval` em processo (mesmo padrão de
`observability/retention.ts`), não como job externo separado. O resto do desenho abaixo
(StoragePort, adapters, soft delete, permissões) foi implementado como descrito.

---

## 0. Pré-requisitos (checados antes de escrever esta spec)

| Item | Estado atual | Ação necessária antes de implementar |
| --- | --- | --- |
| `@vercel/blob` em `package.json` | **Ausente** — `dependencies` só tem `@vercel/functions` | `npm install @vercel/blob` |
| `BLOB_READ_WRITE_TOKEN` no ambiente | **Ausente** — não existe em `.env` nem em `.env.example` | Provisionar um Blob Store no dashboard Vercel (ou `vercel blob store add`), vincular ao projeto, adicionar a env var por instância/site — mesmo padrão já usado para `DATABASE_URL`/`GOOGLE_ID`/`GOOGLE_SECRET` (`docs/venore-docks.md` → "Configuração") |

Esta spec assume que ambos os itens serão resolvidos antes de qualquer PR de implementação. Nenhuma parte do desenho abaixo depende de já estarem prontos — mas nenhuma migration deve ser gerada nem `VercelBlobAdapter` codificado enquanto isso não acontecer, para não deixar código morto sem forma de testar em runtime real.

## 0.1 Estado atual (o que já existe, e o que esta spec muda)

Este repositório **já tem** um context `media` próprio (`src/contexts/media/`), separado de `cms`, com:
- `contracts/types.ts` → `MediaRecord`
- `database/schema/index.ts` → `pgSchema("media")`, tabela `files`
- `features/files/{upload,list,get,delete}-media/` no fluxo `handler → service → store → types`
- `infrastructure/storage/storage-adapter.ts` → `StorageAdapter` (`put`/`delete`) + `LocalStorageAdapter`
- `platform/media-lifecycle/delete-media-safely.ts` → ponto de composição que checa `cms.isMediaReferenced` e `isMediaReferencedByBrand` antes de apagar

Isso já é o resultado do erro documentado na ADR de referência (`venore-docks`, `adr-cms-media-photo-gallery-ownership.md`): lá, `photo-gallery` chegou a criar/listar mídia diretamente, e a correção foi dar à mídia um dono explícito com contrato público. Aqui esse dono já existe como context próprio — um passo além do que a própria referência recomenda (que mantém mídia dentro de `cms`). A Seção 1 defende por que isso deve continuar assim, não regredir para dentro do `cms`.

O que esta spec propõe mudar/adicionar, em relação ao estado atual:

| Área | Hoje | Proposta |
| --- | --- | --- |
| Tabela | `files` (6 colunas) | `assets` — mais colunas, soft delete, checksum |
| Storage port | `StorageAdapter` (`put`/`delete`) | `StoragePort` (contrato ampliado — Seção 2), adapters `VercelBlobAdapter` + `InMemoryStorageAdapter` |
| Upload | só server-buffered (`uploadMedia`, todo o arquivo via `Buffer` na server action) | mantém `uploadMedia` para arquivos pequenos + novo fluxo de client-upload direto ao Blob para arquivos maiores |
| Delete | hard delete imediato (`deleteMedia` apaga blob + linha) | soft delete (`deletedAt`) + purge posterior via sweep |
| Permissions | `media.manage` cobre tudo | mantém `media.manage`, adiciona `media.purge` para o hard delete irreversível |

---

## 1. Dono dos dados

**Decisão: `media` continua um context próprio (`src/contexts/media/`), não uma slice dentro de `cms`.**

### Por quê, especificamente neste repo

1. **A referência (`venore-docks`) colocou mídia dentro de `cms` e isso já causou o problema que ela documenta.** A ADR `adr-cms-media-photo-gallery-ownership.md` descreve `photo-gallery` acessando/criando assets de mídia diretamente porque a fronteira entre "quem edita conteúdo" e "quem guarda o arquivo" nunca ficou formalmente separada — media virou uma sub-responsabilidade implícita de CMS, fácil de furar. Um context próprio remove essa ambiguidade estruturalmente: não existe "dentro do cms" para um módulo se aproximar por engano.
2. **Mídia não é conteúdo editorial — é um recurso técnico consumido por vários domínios.** Neste repo, mídia já é referenciada por `cms` (campo `mediaId` em `entries`), por `brand`/`settings` (logo, logo-scrolled, favicon) e, pela spec, deve ser referenciável por `page-builder` e por plugins como `academy` (thumbnail de curso). Se mídia morasse dentro de `cms`, todo domínio não-CMS que precisasse de um asset teria que atravessar a fronteira de `cms` para chegar em algo que não é conceitualmente CMS — errado tanto para `brand` quanto para `academy`, que não são CMS.
3. **A hierarquia de dependência entre contexts já é declarada e unidirecional** (`docs/venore-docks.md`, regra 12): `auth` não depende de nada; `rbac` depende de `auth`; `settings` depende de `auth`+`rbac`; contexts de domínio (CMS, mídia, temas...) podem depender de `auth`/`rbac`/`settings`, nunca o contrário. `media` como context de domínio irmão de `cms` — não filho — mantém essa hierarquia limpa. `cms` já depende de `media` (valida `mediaId` ao criar/atualizar entry); se mídia estivesse dentro de `cms`, essa dependência colapsaria em auto-referência sem clarificar nada.
4. **O enforcement mecânico já existe e já cobre isso.** `eslint-plugin-boundaries` (regra 9 do documento de arquitetura) e o fato de `media` ter seu próprio `pgSchema("media")` (não um prefixo de tabela dentro do schema de `cms`) tornam um join acidental entre os dois domínios um erro de lint **e** um erro de SQL — a mesma dupla proteção que `docs/venore-docks.md` já descreve para `rbac`/`cms`.

### Regra inegociável

> Plugins e outros contexts referenciam mídia por **`mediaId: string`** — nunca importam `contexts/media/database/schema` nem o `store.ts` de nenhuma feature de `media`. Toda leitura de asset (existência, URL, metadata) passa pelo barrel público `@/contexts/media` (`getMedia`, `listMedia`) ou por `@/contexts/media/contracts` para tipos. Isso vale tanto para escrita quanto para leitura (boundary regra 8) — um `select` direto na tabela `media.assets` de dentro de `cms`, `academy` ou `page-builder` é a mesma violação que o join direto que a ADR de referência documenta, só que sem a palavra "join" no meio.

Concretamente, isso significa: `academy` (plugin) e `page-builder` (platform), ao adicionarem suporte a mídia, seguem o mesmo padrão que `cms.features.entries` já segue hoje — guardam `mediaId` como coluna/campo próprio e chamam `getMedia({ id: mediaId })` do barrel quando precisam resolver a URL/metadata, nunca `import { assets } from "@/contexts/media/database/schema"`.

---

## 2. Porta de armazenamento — `StoragePort`

O `StorageAdapter` atual (`put`/`delete`) cobre o caso mínimo de upload server-buffered. Ele não cobre client-upload direto (necessário para arquivos grandes — Vercel Functions tem limite de body ~4.5MB, e o `uploadMedia` atual passa o arquivo inteiro como `Buffer` pela server action) nem reconciliação (Seção 8). A proposta amplia o contrato e o renomeia para `StoragePort`, para deixar explícito que é uma porta de domínio (linguagem hexagonal), não um adapter concreto.

**Nenhum tipo de `@vercel/blob` aparece neste contrato.** `PutBlobResult`, `HandleUploadBody`, etc. ficam encapsulados dentro de `VercelBlobAdapter` — o contrato fala só a linguagem do domínio (`key`, `data`, `contentType`, `url`).

```ts
// src/infrastructure/storage/storage-port.ts

export type StoredObject = {
  key: string;
  url: string;
  size: number;
};

export type StoragePutInput = {
  key: string;
  data: Buffer;
  contentType: string;
};

export type UploadTicketInput = {
  key: string;
  contentType: string;
  maxSizeBytes: number;
};

// Credencial de upload direto do client até o storage, sem o arquivo passar pelo servidor Next.
export type UploadTicket = {
  key: string;
  uploadUrl: string;
  token: string;
  expiresAt: Date;
};

export type RemoteObjectSummary = {
  key: string;
  size: number;
  uploadedAt: Date;
};

export interface StoragePort {
  /** Upload server-buffered — o servidor já tem os bytes em memória (arquivos pequenos). */
  store(input: StoragePutInput): Promise<StoredObject>;

  /** Remove definitivamente o objeto. Idempotente: remover uma key inexistente não é erro. */
  remove(key: string): Promise<void>;

  /** Resolve a URL pública/servível de uma key já armazenada, sem round-trip à rede. */
  resolveUrl(key: string): string;

  /**
   * Emite uma credencial de upload direto do browser até o storage (Seção 7/9) —
   * necessária para arquivos que excedem o limite de body de uma function.
   */
  createUploadTicket(input: UploadTicketInput): Promise<UploadTicket>;

  /**
   * Lista objetos existentes no storage, para reconciliação (Seção 8) — nunca usado
   * no caminho síncrono de upload/delete, só por `reconcileOrphanUploads`.
   */
  listObjects(prefix?: string): Promise<RemoteObjectSummary[]>;
}
```

### Adapters

| Adapter | Onde vive | Uso |
| --- | --- | --- |
| `VercelBlobAdapter` | `src/infrastructure/storage/vercel-blob-adapter.ts` | produção/preview — usa `put`, `del`, `list`, `generateClientTokenFromReadWriteToken` de `@vercel/blob` (server) internamente, nunca expostos fora do arquivo |
| `LocalStorageAdapter` | já existe, mantido | dev local sem Blob configurado (`MEDIA_STORAGE_DRIVER=local`, default atual) |
| `InMemoryStorageAdapter` | `src/infrastructure/storage/in-memory-storage-adapter.ts` | testes unitários/integração — guarda um `Map<key, Buffer>` em memória, nunca toca disco/rede |

A fábrica em `infrastructure/storage/index.ts` ganha um terceiro `case` (`"vercel-blob"`) além de `"local"`; o `default` continua lançando erro explícito para driver desconhecido — sem fallback silencioso.

```ts
function createStoragePort(): StoragePort {
  const driver = process.env.MEDIA_STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
      return new LocalStorageAdapter();
    case "vercel-blob":
      return new VercelBlobAdapter();
    default:
      throw new Error(`Driver de storage desconhecido: "${driver}".`);
  }
}
```

`createUploadTicket` no `VercelBlobAdapter` chama `generateClientTokenFromReadWriteToken` (client upload) — no `LocalStorageAdapter`/`InMemoryStorageAdapter`, é implementado de forma degradada mas funcional (retorna uma URL local que o client faz `PUT` direto no filesystem/memória via uma rota auxiliar), para que o fluxo de client-upload seja exercitável em teste/dev sem depender do Blob real.

---

## 3. Schema

```ts
// src/contexts/media/database/schema/index.ts

import { boolean, index, integer, pgSchema, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/contexts/auth/database/schema";

export const mediaSchema = pgSchema("media");

export const assets = mediaSchema.table(
  "assets",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pathname: text("pathname").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    checksum: text("checksum").notNull(),
    uploadedBy: text("uploaded_by").notNull().references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("media_assets_pathname_idx").on(table.pathname),
    index("media_assets_checksum_idx").on(table.checksum),
    index("media_assets_uploaded_by_idx").on(table.uploadedBy),
    index("media_assets_deleted_at_idx").on(table.deletedAt),
  ],
);
```

### Justificativa coluna a coluna

| Coluna | Por quê |
| --- | --- |
| `id` | Identidade estável, independente de storage — é o que `mediaId` em outros domínios referencia. UUID gerado em app, não serial, para não vazar contagem/ordem de upload. |
| `pathname` | A key real no Blob Store (o que `VercelBlobAdapter` usa em `remove`/`resolveUrl`). Guardada separada de `url` porque a URL pode mudar (custom domain, CDN, migração de storage) sem que a key mude — reconciliação (Seção 8) compara `pathname`, não `url`. **Único** — nenhum objeto de storage é referenciado por duas linhas. |
| `url` | URL pública resolvida no momento do registro — evita recalcular/consultar o storage a cada leitura. Se o domínio de CDN mudar, é um dado derivável e re-gerável a partir de `pathname`, nunca a fonte de verdade sozinha. |
| `contentType` | Necessário para servir o asset com o header correto e para a allowlist de MIME (Seção 5) ser auditável depois do fato, não só no momento do upload. |
| `size` | Bytes — usado por limite por tipo (Seção 5) e por qualquer relatório futuro de uso/cota (Seção 8, "estouro de cota"). |
| `width` / `height` | Nulos para não-imagem. Evita que toda página/bloco que renderiza uma imagem precise abrir o arquivo para saber a proporção (layout shift, `next/image` exige dimensão). Extraídas no momento do registro (Seção 4), não recalculadas depois. |
| `alt` | Texto alternativo — acessibilidade e SEO. Nulo permitido no upload (nem todo asset é imagem editorial), mas a UI de CMS/page-builder deve cobrar preenchimento antes de publicar uma entry/bloco que usa a imagem — isso é responsabilidade de quem consome o asset, não do context `media`. |
| `checksum` | SHA-256 do conteúdo. Habilita deduplicação (Seção 8, "upload duplicado") e detecção de corrupção (comparar checksum declarado vs. recalculado). Indexado porque `registerUploadedMedia` faz lookup por checksum antes de criar linha nova. |
| `uploadedBy` | Auditoria/atribuição — quem enviou o arquivo. FK para `auth.users`, mesmo padrão de `entries.createdBy` em `cms`. `NOT NULL` porque todo upload passa por um `actor` autenticado (mesmo o fluxo client-upload — Seção 9); não existe upload anônimo. |
| `deletedAt` | Soft delete (Seção 7). Nulo = ativo. Preenchido = fora de listas/pickers, mas blob e linha ainda existem até o sweep de purge. |
| `createdAt` / `updatedAt` | Padrão de auditoria já usado em todo o schema do repo (`files.createdAt` hoje já segue isso). |

Nota deliberada: **não existe coluna `status` separada** (`pending`/`committed`/etc.). Uma linha em `media.assets` só existe depois que o upload já está confirmado no storage (Seção 4/9) — não há estado intermediário persistido para "ticket emitido, upload ainda não confirmado". Isso evita lixo de linhas `pending` de uploads abandonados; o preço é que um upload em andamento não aparece em lugar nenhum até `registerUploadedMedia` — trade-off aceito porque simplifica o schema e o "upload órfão" já é tratado do lado do storage (Seção 8), não do lado do banco.

### Índices

- `media_assets_pathname_idx` (único): garante 1:1 entre linha e objeto de storage, e é o índice usado por `registerUploadedMedia` para upsert idempotente (Seção 9).
- `media_assets_checksum_idx`: lookup de deduplicação em `registerUploadedMedia`.
- `media_assets_uploaded_by_idx`: telas de "meus uploads" e auditoria por usuário.
- `media_assets_deleted_at_idx`: toda query de listagem filtra `deletedAt IS NULL`; toda query do sweep de purge filtra `deletedAt IS NOT NULL AND deletedAt < cutoff` — os dois padrões de acesso mais frequentes na tabela seguem esse índice.

Migration real (`drizzle-kit generate`) fica para a implementação — fora do escopo desta sessão.

---

## 4. Use cases

Seguem o padrão de pastas já usado em `contexts/media/features/files/<use-case>/` (`handler.ts` → `service.ts` → `store.ts` → `types.ts`), todos retornando `OperationResult<T>`.

| Use case | Entrada | Saída | Notas |
| --- | --- | --- | --- |
| `requestMediaUploadTicket` | `{ filename, contentType, size }` | `OperationResult<{ pathname, uploadUrl, token, expiresAt }>` | Valida allowlist/limite (Seção 5) **antes** de emitir o ticket — rejeitar cedo, não depois do upload. Autoriza `media.upload`. Não escreve no banco (Seção 0.1, nota sobre não existir estado `pending`). |
| `registerUploadedMedia` | `{ pathname, contentType, size, checksum, width?, height?, alt? }` (+ `actorId` resolvido pelo handler) | `OperationResult<MediaAsset>` | Ponto único de criação de linha (Seção 9). Idempotente por `pathname`: upsert, não insert cego. Deduplica por `checksum` quando aplicável (Seção 8). |
| `uploadMedia` | `{ filename, mimeType, size, data }` (já existe) | `OperationResult<MediaAsset>` | Mantido para arquivos pequenos (ícones, avatares) que cabem inteiros no body de uma server action. Internamente chama `storagePort.store` + a mesma lógica de persistência de `registerUploadedMedia` (evita duplicar a regra de dedup/checksum em dois lugares). |
| `getMediaAsset` | `{ id }` | `OperationResult<MediaAsset \| null>` | Renomeado de `getMedia` para casar com "asset" (Seção 0.1). Exclui `deletedAt IS NOT NULL` por padrão. |
| `listMediaAssets` | `{ cursor?, limit? }` | `OperationResult<MediaAsset[]>` | Renomeado de `listMedia`. Mesma exclusão de soft-deleted. |
| `deleteMedia` | `{ id }` (+ `actorId`) | `OperationResult<{ id: string }>` | Agora é **soft delete** — seta `deletedAt`, não chama `storagePort.remove` (Seção 7). Continua exigindo passar por `platform/media-lifecycle/delete-media-safely.ts` (regra 14), não chamado direto por UI. |
| `purgeMediaAsset` | `{ id }` (+ `actorId`) | `OperationResult<{ id: string }>` | Hard delete real: `storagePort.remove` + apaga a linha. Só chamado por `sweepSoftDeletedMedia` (job) ou por uma ação administrativa explícita de superadmin — nunca pela mesma ação de UI que soft-deleta (Seção 6/7). |
| `reconcileOrphanUploads` | `{}` | `OperationResult<{ removed: number }>` | Sweep: `storagePort.listObjects()` vs. `pathname`s conhecidos; remove do storage os que não têm linha correspondente e passaram do TTL de graça (Seção 8). |
| `sweepSoftDeletedMedia` | `{}` | `OperationResult<{ purged: number; skipped: number }>` | Job periódico: para toda linha com `deletedAt` mais antigo que a janela de graça (Seção 7), re-checa referências e chama `purgeMediaAsset` se ainda estiver livre. |

`requestMediaUploadTicket` e `registerUploadedMedia` são novos; os demais já existem hoje (com pequenos ajustes de nome/comportamento indicados na tabela).

---

## 5. Validação e limites

### Allowlist de MIME (nunca blocklist)

```ts
const MEDIA_ALLOWED_TYPES: Record<string, { category: "image" | "document" | "video"; maxSizeBytes: number }> = {
  "image/png": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "image/jpeg": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "image/webp": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "image/gif": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "application/pdf": { category: "document", maxSizeBytes: 20 * 1024 * 1024 },
  "video/mp4": { category: "video", maxSizeBytes: 200 * 1024 * 1024 },
  "video/webm": { category: "video", maxSizeBytes: 200 * 1024 * 1024 },
};
```

- **Atualizado na 0.6.0:** `image/svg+xml` **entrou** na allowlist (2MB), sanitizado por
  `sanitizeSvgBuffer` antes de ir pro storage e servido com CSP `sandbox` + `nosniff` — ver
  `src/contexts/media/contracts/types.ts`. Texto original: `image/svg+xml` **deliberadamente fora da allowlist**: SVG pode carregar script embutido — risco de XSS ao servir como asset "de imagem". Se um site precisar de SVG editorial no futuro, isso é uma decisão própria (com sanitização de XML), não uma extensão trivial desta lista.
- Qualquer `contentType` fora do mapa é rejeitado em `requestMediaUploadTicket`/`uploadMedia` com `media.upload.unsupported_type` — nunca um "provavelmente ok, vamos tentar".
- O limite de tamanho é **por categoria declarada**, checado duas vezes: no momento do ticket (contra o `size` que o client informa) e de novo em `registerUploadedMedia`/`uploadMedia` contra o `size` real reportado pelo storage — o client pode mentir sobre o `size` ao pedir o ticket, mas não pode mentir sobre quantos bytes o storage efetivamente recebeu.
- Vídeo **só** é aceito pelo fluxo de client-upload (`requestMediaUploadTicket`) — nunca por `uploadMedia` (server-buffered), porque 200MB não cabe no limite de body de uma function de qualquer forma.

### Sanitização de nome de arquivo

Reaproveita a função já existente em `upload-media/service.ts`:

```ts
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}
```

Aplicada ao nome original antes de compor a `pathname` — remove caracteres de path traversal, espaço, unicode não confiável.

### Sufixo aleatório obrigatório

`pathname` nunca é só o nome sanitizado — sempre `${crypto.randomUUID()}-${sanitizeFilename(filename)}`, exatamente como `uploadMedia` já faz hoje. Isso vale tanto para o fluxo server-buffered quanto para o client-upload (o `pathname` é decidido no servidor, dentro de `requestMediaUploadTicket`, nunca aceito do client). No `VercelBlobAdapter`, isso é reforçado mantendo `addRandomSuffix: true` (comportamento default do Blob) como camada extra — cinto e suspensório, não substituto do prefixo que o domínio já controla.

---

## 6. Permissões RBAC

Segue o namespace `dominio.recurso.acao` já usado (`docs/venore-docks.md` → "Modelo de RBAC") e o padrão de comentário "stopgap" já presente em `RBAC_PERMISSIONS` para permissions que conceitualmente pertencem a um context mas ainda vivem no catálogo central por falta de agregação entre contexts.

| Permission | Label | Cobre |
| --- | --- | --- |
| `media.manage` (já existe) | "Gerenciar arquivos de mídia" | `requestMediaUploadTicket`, `registerUploadedMedia`, `uploadMedia`, `deleteMedia` (soft), `listMediaAssets`, `getMediaAsset` |
| `media.purge` (novo) | "Apagar mídia definitivamente" | `purgeMediaAsset` manual (fora do sweep automático) — ação irreversível que remove o blob de verdade |

Mapeamento para papéis existentes:

| Papel | `media.manage` | `media.purge` |
| --- | --- | --- |
| `superadmin` | sim | sim |
| `admin` | sim | não |
| `member` | não | não |

`media.purge` fica restrito a `superadmin` porque, diferente de `deleteMedia` (reversível — a linha e o blob continuam existindo até o sweep), `purgeMediaAsset` é a operação que efetivamente perde o arquivo. `sweepSoftDeletedMedia` (o job) não passa por RBAC — roda como processo de sistema, não como ator autenticado; a autorização acontece uma vez, na decisão de habilitar o job, não a cada purge individual que ele executa.

Não se propõe dividir `media.manage` em `media.upload`/`media.read`/`media.delete` separados agora — o catálogo atual já trata upload e delete como a mesma permission, e granular isso sem um pedido concreto de "quero dar upload sem dar delete" seria antecipar necessidade, não resolver uma.

---

## 7. Ciclo de vida e deleção

### Quem pode referenciar um asset hoje/no futuro próximo

| Domínio | Onde guarda `mediaId` | Função de checagem |
| --- | --- | --- |
| `cms` (entries) | coluna `mediaId` em `entries` | `isMediaReferenced` (já existe) |
| `brand` / `settings` | valores de `logoMediaId`, `logoScrolledMediaId`, `faviconMediaId` | `isMediaReferencedByBrand` (já existe) |
| `page-builder` | `mediaId` dentro do JSON de props de blocos | `isMediaReferencedByPageBuilder` (a criar) |
| `academy` (plugin) | coluna de thumbnail/capa em `courses` (se/quando existir) | `isMediaReferencedByAcademy` (a criar, no plugin) |

Cada domínio novo que passa a guardar um `mediaId` ganha sua própria função `isXReferenced`, seguindo o padrão que `cms` e `brand` já estabeleceram — **não** um registro genérico de "quem referencia o quê". Isso é deliberado: um registro genérico exigiria todo domínio se anunciar num lugar central, o que é mais mecanismo do que o problema pede agora (só 2 domínios hoje, 2 candidatos previsíveis). Se um terceiro/quarto caso aparecer e o padrão de "adicionar mais uma função na lista" começar a doer, isso vira uma decisão própria de registry — mesmo raciocínio que `docs/venore-docks.md` já aplica à regra 14 ("por ora é convenção de comentário... numa terceira ocorrência, vale desenhar enforcement de verdade").

### Descoberta de referências antes de apagar

`platform/media-lifecycle/delete-media-safely.ts` (já existe) é estendido para checar as quatro fontes, não só duas:

```ts
export async function deleteMediaSafely(input: { id: string }): Promise<OperationResult<{ id: string }>> {
  for (const check of [isMediaReferenced, isMediaReferencedByBrand, isMediaReferencedByPageBuilder, isMediaReferencedByAcademy]) {
    const referenced = await check({ mediaId: input.id });
    if (!referenced.success) return referenced;
    if (referenced.data) return { success: false, error: { code: "media.delete.in_use", message: "..." } };
  }
  return deleteMedia({ id: input.id }); // agora soft delete — ver abaixo
}
```

### O que acontece com um asset referenciado

Se qualquer checagem retornar `true`: a operação falha com `media.delete.in_use`, sem soft-deletar. Isso não muda em relação ao comportamento atual — só o número de checagens aumenta.

### Soft delete + coleta posterior

1. `deleteMedia` (chamado só via `deleteMediaSafely`, nunca direto — regra 14) passa a **setar `deletedAt = now()`**, sem chamar `storagePort.remove`. O asset some de `listMediaAssets`/`getMediaAsset` (que filtram `deletedAt IS NULL`) e de qualquer picker de UI, mas o blob continua servível pela `url` já publicada — importante porque uma entry publicada pode ainda estar renderizando essa URL em cache/CDN por um tempo, mesmo já removida da lista de escolha.
2. Janela de graça configurável via `contexts/settings` (ex: `media.softDeleteGraceDays`, default 14) — não hardcoded, mesmo padrão de "o que é trocável em runtime vive em settings, não em env var" já estabelecido em `docs/venore-docks.md`.
3. Job periódico `sweepSoftDeletedMedia` (Runtime — `docs/venore-docks.md` → camada Runtime) roda diariamente:
   - seleciona `assets` com `deletedAt < now() - graceDays`
   - **re-checa** as quatro fontes de referência (não confia que "já checou uma vez" ainda vale — algo pode ter mudado desde o soft delete, mesmo que a UI não devesse permitir re-referenciar um asset soft-deletado)
   - se ainda livre: chama `purgeMediaAsset` (blob + linha, de verdade)
   - se voltou a estar referenciado: **não purga, não restaura sozinho** — só loga a anomalia. Um asset soft-deletado voltar a ser referenciado não deveria acontecer se a UI exclui soft-deletados dos pickers; se acontecer, é sinal de bug em outro lugar, e a correção automática (restaurar) esconderia esse sinal em vez de expor.

### Por que não hard-delete direto

Hard delete imediato (comportamento atual de `deleteMedia`) é irreversível no primeiro erro de checagem de referência — um domínio novo (`page-builder`, `academy`) que ainda não tenha sua função `isXReferenced` no momento em que passa a guardar `mediaId` teria um asset apagado por baixo dos pés sem aviso. Soft delete + janela de graça dá margem para esse tipo de gap ser descoberto (asset "sumido" de uma página, mas o blob e a linha ainda existem por N dias) antes de virar perda de dado permanente.

---

## 8. Riscos e modos de falha

| Modo de falha | Como acontece | Tratamento |
| --- | --- | --- |
| **Upload órfão** (blob existe, registro não) | Client recebeu o ticket, subiu o arquivo, mas fechou a aba/perdeu conexão antes de `registerUploadedMedia` completar; ou (dev) o webhook `onUploadCompleted` nunca dispara (Seção 9) e nenhuma chamada de confirmação client-side aconteceu | `reconcileOrphanUploads`: `storagePort.listObjects()` comparado contra `pathname`s em `media.assets`; blobs sem linha correspondente e com mais de X horas (TTL de graça, ex: 24h — dá tempo pro registro tardio acontecer) são removidos do storage. Roda como job periódico em prod; pode ser disparado manualmente em dev. |
| **Registro órfão** (registro existe, blob não) | Blob removido fora da aplicação (dashboard/API da Vercel usado manualmente); ou falha parcial entre `storagePort.remove` e o delete da linha em `purgeMediaAsset` | `purgeMediaAsset` remove o blob **antes** de apagar a linha (nunca a ordem inversa) — se o `remove` falhar, a linha permanece e a operação retorna erro, não completa "pela metade". Para o caso de remoção manual externa: acesso a um asset cuja `url` retorna 404 é responsabilidade de quem consome (CMS/page-builder tratam imagem quebrada como já tratariam qualquer asset externo indisponível) — não há verificação ativa e contínua de todo asset (custaria uma requisição HTTP por asset por verificação); fica registrado como gap conhecido, não como resolvido. |
| **Upload duplicado** | Mesmo arquivo (mesmo conteúdo) enviado duas vezes, por engano ou por dois usuários | `registerUploadedMedia` calcula/recebe o `checksum` e faz lookup em `media_assets_checksum_idx` antes de inserir; se já existe uma linha ativa (`deletedAt IS NULL`) com o mesmo checksum, retorna essa linha em vez de criar outra. Um checksum batendo com um asset **soft-deletado** não é reaproveitado — trataria como upload novo, para não ressuscitar silenciosamente algo que foi removido de propósito. |
| **Arquivo corrompido** | `contentType` declarado não bate com o conteúdo real (ex: `.png` que na verdade é HTML/script) | `registerUploadedMedia`/`uploadMedia` fazem sniffing dos magic bytes do conteúdo (não confiam só no `contentType` que o client declarou) e rejeitam com `media.upload.content_mismatch` se não bater com nenhum tipo da allowlist (Seção 5). Isso é validação de conteúdo, separada da validação de `contentType` declarado — as duas rodam. |
| **Estouro de cota** | Blob Store atinge limite de tamanho/bandwidth do plano Vercel | `StoragePort.store`/`createUploadTicket` propagam um erro tipado (`media.storage.quota_exceeded`), distinto de falha genérica de infra — o `service` captura esse erro específico e retorna `OperationResult` de erro de negócio (o usuário vê "sem espaço de armazenamento", não uma exception genérica de 500). Visibilidade de uso/cota (dashboard admin mostrando "X GB usados de Y") **não** está coberta por esta spec — mesmo padrão de gap já aceito em `docs/venore-docks.md` ("Ainda não coberto: acesso a arquivos de mídia" / rate limiting), registrar como Known Gap na implementação, não resolver aqui. |

---

## 9. Ponto crítico: `onUploadCompleted` não dispara em localhost

### O problema

O fluxo de client-upload do `@vercel/blob/client` tem duas etapas server-side distintas, com naturezas diferentes:

1. **`onBeforeGenerateToken`** — roda dentro da própria rota Next.js (`POST /api/media/upload-ticket`, por exemplo) em resposta a um `fetch` que o **browser** faz para o **seu próprio servidor**. Funciona igual em `localhost:3000` e em produção, porque é só um request HTTP normal do client para o dev server.
2. **`onUploadCompleted`** — é um **webhook**: depois que o upload chega ao Blob Store, é a infraestrutura da Vercel (servidor deles) que faz uma chamada HTTP de volta para a sua rota. Isso exige uma URL publicamente alcançável. `localhost` não é alcançável pela internet — a Vercel não consegue chamar de volta, então **esse callback nunca dispara em dev**, mesmo com o token/upload funcionando perfeitamente.

Se `registerUploadedMedia` só fosse chamado dentro de `onUploadCompleted`, o resultado seria: upload funciona visualmente em dev (o arquivo sobe, `upload()` resolve no browser), mas nenhuma linha nunca é criada em `media.assets` — divergência de comportamento entre ambientes que só aparece em produção, o pior tipo de bug para achar.

### A decisão de desenho

**`registerUploadedMedia` nunca é chamado só pelo webhook.** O caminho primário e único que a lógica de domínio conhece é:

1. O browser chama `requestMediaUploadTicket` (via server action/rota) → recebe `{ pathname, uploadUrl, token }`.
2. O browser faz o upload direto ao Blob Store usando o SDK client (`upload()` de `@vercel/blob/client`), passando o `token`.
3. Quando essa chamada **resolve no próprio browser** (a promise de `upload()` — não o webhook, o retorno direto da função), o browser chama `registerUploadedMedia` (via server action/rota) com os dados retornados (`pathname`, `url`, `contentType`, `size`) mais o `checksum` calculado no client antes do upload.
4. `registerUploadedMedia` persiste a linha. Este passo **acontece sempre**, em dev e em produção, porque depende só do browser ter conseguido completar o upload — nunca de um callback de infraestrutura.

`onUploadCompleted`, quando configurado em produção (onde a URL pública existe), **chama exatamente esse mesmo `registerUploadedMedia`** — como uma segunda chamada, idempotente por `pathname` (Seção 3/4), para cobrir o caso em que o browser completou o upload mas fechou a aba antes do passo 3 rodar (ex: conexão caiu bem ali). Em dev, esse caso de "browser sumiu entre upload e confirmação" não é coberto pelo webhook (que não dispara) — é coberto pelo `reconcileOrphanUploads` (Seção 8), que é o mesmo mecanismo de rede de segurança que já existe para produção também, só que em dev é o único mecanismo, porque o webhook não existe.

### Por que isso não diverge lógica de domínio entre ambientes

- `registerUploadedMedia` (o use case que decide "isso é um `MediaAsset` válido agora") roda **um único código**, chamado do mesmo lugar (confirmação client-side), em dev e em produção. Não existe um `if (isDev)` em lugar nenhum da regra de negócio.
- O webhook, quando existe, não contém regra de negócio própria — é só mais um chamador do mesmo `registerUploadedMedia`, tratado como "o browser confirmou de outro jeito". Ele roda como um `actor` de sistema (não um usuário autenticado — a autorização já aconteceu no passo 1, quando o ticket foi emitido para um `actorId` específico, carregado no `token`).
- A única coisa que difere entre ambientes é **qual mecanismo de rede de segurança cobre o caso de abandono** (webhook + reconciliação em prod; só reconciliação em dev) — isso é uma diferença de infraestrutura disponível, não uma diferença de comportamento de domínio. `reconcileOrphanUploads` já precisa existir de qualquer forma (Seção 8, "upload órfão" também acontece em produção por outros motivos — timeout de rede, etc.), então não é um mecanismo extra criado só para compensar dev.

---

## 10. Variantes de imagem (2026-09-30)

Upload de `image/jpeg|png|webp` gera cópias WebP redimensionadas (`contexts/media/image-variants.ts`),
gravadas em `media.asset_variants` (uma linha por largura, `pathname` próprio no storage —
`Imagens/<uuid>-foto.w480.webp`). O original em `media.assets` não muda.

- **Larguras:** 160 / 480 / 960 / 1920 abaixo da largura do original, mais a própria largura
  (limitada a 1920). Nunca amplia. Qualidade 82 (foto) / 90 (PNG de origem), alpha sem perda,
  orientação EXIF aplicada. GIF (animado) e SVG (vetor) não geram variante.
- **Quando:** logo depois de gravar o asset, nos 3 uploads server-buffered (bytes em memória) e no
  `registerUploadedMedia` do upload direto (lê o original do storage uma vez). Falha nunca
  derruba o upload: o asset segue servindo o original e `variants_processed_at` fica nulo.
- **Backfill:** `backfillAssetVariants` (botão "Otimizar imagens antigas" em `/admin/media`,
  `media.manage`) processa em lotes de até 20 os assets com `variants_processed_at` nulo.
- **URL:** calculada na leitura, com a mesma regra do original — público + storage servível = URL
  direta; senão `/api/media/asset/<id>?w=<largura>` (autorização do asset). Por isso trocar a
  visibilidade vale pras variantes sem regravar nada.
- **Escolha:** `pickMediaVariantUrl(asset, larguraCss)` pega a menor variante ≥ 2× a largura;
  `buildMediaSrcSet(asset)` monta o `srcset`; `getMediaAssetUrls({ ids, displayWidth })` faz o
  mesmo em lote. Sem variante (não é imagem, backfill pendente) = original.
- **Ciclo de vida:** purge remove os objetos das variantes antes do hard delete (as linhas caem
  por cascade); `reconcileOrphanUploads` inclui os pathnames de variante no conjunto conhecido.

## Resumo do que falta para implementar (fora desta sessão)

1. Resolver os dois pré-requisitos da Seção 0.
2. `drizzle-kit generate` para a migration de `files` → `assets` (schema novo, dados existentes precisam de estratégia de migração de coluna — não coberta aqui, é decisão de implementação).
3. Codificar `StoragePort`, `VercelBlobAdapter`, `InMemoryStorageAdapter`.
4. Codificar os use cases novos/ajustados da Seção 4.
5. Estender `delete-media-safely.ts` com as duas funções `isXReferenced` que ainda não existem (Seção 7) — só quando `page-builder`/`academy` de fato passarem a guardar `mediaId`, não antes.
6. Seed de `media.purge` para `superadmin`, mesmo padrão de `scripts/seed-media-manage-permission.mjs`.
7. Job de `sweepSoftDeletedMedia`/`reconcileOrphanUploads` no Runtime.
