# Storage de mídia em disco (`MEDIA_STORAGE_DRIVER=filesystem`)

Driver de storage de `contexts/media` que grava os arquivos **no disco do próprio servidor** e os
serve por uma rota interna, em vez de mandar pro Vercel Blob. Feito para uma instância
**self-hosted numa rede local** — o caso concreto: o servidor onde o plugin **Broadcast** roda
fica na LAN, os PCs das TVs consomem dele pela rede, e nada de mídia deve sair pra internet.

Reintroduz o conceito do antigo `LocalStorageAdapter` (descontinuado na Fase 4/M1-M3), agora com
rota de servir sandboxed e sidecar de metadata — ver `docs/media/blob-spec.md` para o contrato
`StoragePort` que todos os drivers implementam.

## Configuração (`.env` do servidor)

```dotenv
MEDIA_STORAGE_DRIVER=filesystem

# Onde gravar. Relativo ao cwd (raiz do projeto), ou absoluto (ex: um mount de NAS).
# Default: ./media-storage
MEDIA_FILESYSTEM_ROOT=./media-storage

# Opcional. Base da URL que o browser/TV usa pra buscar o arquivo.
# Default: /api/media/file  (relativo — resolve contra a origem do app; é o que a LAN precisa).
# Só defina se a mídia for servida por outro host/porta que não o app.
MEDIA_FILESYSTEM_PUBLIC_URL=
```

`MEDIA_FILESYSTEM_ROOT` fica **fora de `public/`** de propósito: os arquivos são servidos só pela
rota sandboxed, nunca como asset estático do Next. `./media-storage/` está no `.gitignore`.

## Como funciona

| Peça | O quê |
| --- | --- |
| `src/infrastructure/storage/filesystem-storage-adapter.ts` | `FilesystemStorageAdapter` — `store` grava `<root>/<key>` + um sidecar `<key>.meta.json` (`contentType`, `size`, `uploadedAt`). `remove` apaga os dois. `resolveUrl` devolve `<publicBase>/<key>` (segmentos URL-encoded). `listObjects` varre a árvore ignorando os `.meta.json`. |
| `src/app/api/media/file/[...key]/route.ts` | `GET` que serve o arquivo: resolve a key contra `MEDIA_FILESYSTEM_ROOT` com `resolveWithinRoot` (rejeita `..`/escape), lê o `contentType` do sidecar (fallback pela extensão), responde com `Cache-Control: public, max-age=31536000, immutable` (a key tem UUID, conteúdo imutável) e suporta um `Range` simples. Só existe quando o driver é `filesystem` — senão devolve 404. |
| `src/infrastructure/storage/index.ts` | `createStoragePort()` mapeia `"filesystem"` pro adapter. |

A URL relativa (`/api/media/file/Imagens/<uuid>-nome.png`) é **persistida** no registro do asset
(`media.assets.url`, via `insertAsset`), igual a URL do Blob é hoje. A view de saída da TV é
servida pela mesma origem do servidor local, então o `<img src="/api/media/file/...">` resolve
direto pra ele.

## Limitações (deliberadas)

- **Só upload server-buffered.** `createUploadTicket` (upload direto browser → storage, usado pra
  arquivos grandes no `MediaPickerField`) **lança um erro claro** — ele depende de um endpoint
  externo estilo Blob e do client `@vercel/blob/client`, que não têm equivalente local. Imagens e
  PDFs da biblioteca passam pelo caminho server-buffered (`uploadMediaAsset`) e funcionam. Se
  precisar subir vídeo grande pela biblioteca de mídia nesta instância, use `vercel-blob`.
- **Vídeos do Broadcast não passam por aqui.** Eles ficam em `public/broadcast/videos/` e são
  servidos pela rota do próprio plugin (`/api/broadcast/stream/:itemId`, com Range). Este driver é
  só pra biblioteca de mídia (`contexts/media`) — no Broadcast, as imagens.
- **Auth por asset (desde a 0.6.0).** A rota `/api/media/file/[...key]` só serve keys que são
  assets registrados e aplica a mesma autorização por asset de `/api/media/asset/[id]` (dono,
  `media.manage` ou URL assinada) via `platform/media-serving/serve-media.ts`, com streaming e
  `Range`. Antes, qualquer key sob a raiz era servida sem sessão.
- **`resolveUrl` é resolvido no upload e gravado.** Se você mudar `MEDIA_FILESYSTEM_PUBLIC_URL`
  depois, os registros antigos mantêm a URL antiga (só os novos usam a nova base).
- **Backup é sua responsabilidade.** `MEDIA_FILESYSTEM_ROOT` não é versionado. Faça backup dele
  junto com o banco.

## Migração de/para outro driver

Trocar o driver **não move os arquivos**. Assets criados sob `vercel-blob` continuam apontando pra
URLs de Blob (e param de carregar se o token sair); assets criados sob `filesystem` apontam pra
`/api/media/file/...` (e param de carregar se você voltar pra `vercel-blob` sem os arquivos). Para
uma instância nova de Broadcast na LAN, o cenário limpo é começar já com `filesystem`.
