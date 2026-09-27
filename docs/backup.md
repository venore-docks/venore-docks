# Backup e restauração do banco

`.github/workflows/backup.yml` roda todo dia (02:17, horário de Brasília) e também sob demanda
(Actions → "Backup do banco" → Run workflow).

## Configurar

Em Settings → Secrets and variables → Actions do repositório:

| Secret | Conteúdo |
| --- | --- |
| `BACKUP_TARGETS` | JSON `{ "nome-da-instancia": "postgres://usuario:senha@host/banco?sslmode=require", ... }` — um item por instância (branch). |
| `BACKUP_PASSPHRASE` | Frase longa e aleatória. Cifra os dumps. **Guarde também fora do GitHub** — sem ela o backup é inútil. |

Use um usuário de banco só-leitura para o backup quando o provedor permitir.

## O que é gerado

Um arquivo `<instancia>-<data>.dump.gpg` por instância (pg_dump formato custom, cifrado com GPG
AES-256), guardado como artifact do run por **14 dias**. O repositório é público: nunca desative a
cifragem. Para guardar por mais tempo (recomendado: 30 dias ou mais), baixe os artifacts para um
armazenamento próprio (S3, R2, Drive) — ver custos em `docs/custos-melhorias-e-recursos.md`.

A mídia não está no dump: no Vercel Blob ela fica no próprio Blob Store; no driver filesystem,
copie o diretório `MEDIA_FILESYSTEM_ROOT` junto.

## Restaurar

```bash
gpg --decrypt minha-instancia-20260927T051700Z.dump.gpg > banco.dump
# Banco vazio de destino (nunca por cima do de produção sem ter certeza):
pg_restore --no-owner --no-privileges --clean --if-exists -d "postgres://.../banco_restaurado" banco.dump
```

Depois aponte o `DATABASE_URL` da instância para o banco restaurado e faça um deploy — o
`prebuild` aplica qualquer migration que o dump ainda não tenha.

Teste a restauração de vez em quando (num banco descartável): backup que nunca foi restaurado não
é backup.
