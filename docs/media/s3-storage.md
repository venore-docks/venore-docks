# Driver de storage `s3` (Amazon S3 e compatíveis)

Para instâncias na AWS (ou com MinIO/Cloudflare R2). Implementação:
`src/infrastructure/storage/s3-storage-adapter.ts` (mesma `StoragePort` dos outros drivers — nada
fora dele conhece o SDK da AWS).

## Configuração

| Variável | Obrigatória | O que é |
| --- | --- | --- |
| `MEDIA_STORAGE_DRIVER=s3` | sim | Liga o driver. |
| `S3_BUCKET` | sim | Nome do bucket (um por instância). |
| `S3_REGION` | não (`us-east-1`) | Região do bucket (ex: `sa-east-1`). |
| `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` | não | Chave de um usuário IAM. **Sem elas**, o SDK usa a cadeia padrão da AWS (role da EC2/ECS/Lambda, `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`). Dentro da AWS, prefira o role. |
| `MEDIA_S3_ACCESS` | não (`private`) | `private`: nenhum arquivo é lido pela URL do bucket; tudo passa pela rota autorizada `/api/media/asset/[id]` (bucket pode ficar 100% bloqueado ao público). `public`: assets públicos são servidos direto pelo bucket/CDN. |
| `S3_PUBLIC_URL` | não | Base pública dos arquivos (ex: `https://dxxxx.cloudfront.net`). Sem ela, `https://<bucket>.s3.<região>.amazonaws.com`. |
| `S3_ENDPOINT` + `S3_FORCE_PATH_STYLE=true` | não | Serviço compatível (MinIO, R2). |

## Upload de arquivo grande

Arquivo acima do limite de body da function (vídeo, PDF grande) sobe direto do browser pro bucket
por **presigned POST**: o servidor assina um formulário que só aceita aquela key, aquele
`Content-Type` e até o tamanho máximo do tipo (`content-length-range`) — o próprio S3 recusa um
arquivo maior. Depois o app confere tamanho e tipo reais no bucket (`HeadObject`) antes de
registrar o asset.

Isso exige **CORS no bucket** liberando o POST a partir do domínio do site:

```json
[
  {
    "AllowedOrigins": ["https://www.seusite.com.br"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

(Console do S3 → bucket → Permissions → Cross-origin resource sharing.)

## Permissões IAM mínimas

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::NOME-DO-BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::NOME-DO-BUCKET"
    }
  ]
}
```

`ListBucket` é usado só pela reconciliação de uploads órfãos (job agendado).

## Observações

- Gravação usa escrita condicional (`If-None-Match: *`): uma key existente nunca é sobrescrita sem
  querer, mesmo contrato do Vercel Blob. MinIO e R2 recentes suportam; serviço que não suporte
  responde erro na gravação.
- Trocar uma instância existente de `vercel-blob` para `s3` **não é automático**: os arquivos
  continuam no Blob e cada asset guarda a key e a URL resolvida no upload. Exige copiar os objetos
  (mesmas keys) e regravar `media.assets.url` — ainda não há script pra isso. Para instância nova
  na AWS, basta configurar o driver desde o início.
- Backup: o bucket não entra no `pg_dump` (`docs/backup.md`) — ligue o versionamento do bucket.
