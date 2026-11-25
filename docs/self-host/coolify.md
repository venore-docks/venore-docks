# Instância self-hosted no Coolify

Como rodar uma instância do Venore Docks fora da Vercel, num servidor com [Coolify](https://coolify.io):
app Next.js, Postgres e mídia no mesmo servidor. Caso real: Portal do Colaborador da FEM
(`VENORE_INSTANCE=portal-colaborador`), que saiu da Vercel em nov/2026.

Nada no código depende da Vercel para funcionar: `trustHost: true` (Auth.js), timers em processo
(`IN_PROCESS_JOBS`), driver de mídia `filesystem`, health check em `/api/health`.

## 1. Recursos no Coolify

| Recurso | Configuração |
| --- | --- |
| **PostgreSQL** | Versão **igual ou maior** que a do banco de origem (o `pg_dump` não lê servidor mais novo que ele). Sem porta pública. Backup agendado com destino S3 **fora do servidor**. |
| **Aplicação** | Repositório `venore-docks/venore-docks` (público), branch `main`, build pack **Nixpacks** (Node vem do `.nvmrc`). Porta **3000**. Health check `GET /api/health`. |
| **Volume persistente** | Montado na aplicação em `/data/media` (= `MEDIA_FILESYSTEM_ROOT`). Ative o backup agendado do volume — ele não entra no `pg_dump`. |
| **Domínio** | `https://<dominio>` na aplicação; o Coolify emite o certificado (exige 80/443 acessíveis). |

Build: o `prebuild` gera o registro da instância e roda as migrations — por isso `VENORE_INSTANCE`
e `DATABASE_URL` precisam estar disponíveis **no build** ("Available at Buildtime"). Se o container
de build não alcançar o banco pelo hostname interno, use `SKIP_DB_MIGRATIONS=true` só no build e
rode `npm run db:update` no terminal do container depois do deploy.

## 2. Variáveis de ambiente

| Variável | Valor | Build? |
| --- | --- | --- |
| `VENORE_INSTANCE` | nome do arquivo em `instances/` | sim |
| `DATABASE_URL` | URL interna do Postgres do Coolify | sim |
| `AUTH_SECRET` | `openssl rand -base64 32` | — |
| `SITE_URL` | `https://<dominio>` | sim |
| `MEDIA_STORAGE_DRIVER` | `filesystem` | — |
| `MEDIA_FILESYSTEM_ROOT` | `/data/media` | — |
| `MICROSOFT_ID` / `MICROSOFT_SECRET` / `MICROSOFT_ISSUER` | do app no Entra | — |
| demais envs da instância | ex: `ZAMMAD_URL`, `ZAMMAD_API_TOKEN` | — |

Não levar da Vercel: `POSTGRES_*`, `PG*`, `NEON_PROJECT_ID`, `DATABASE_URL_UNPOOLED`,
`VITE_NEON_AUTH_URL` (integração Neon) e `BLOB_*` (depois da migração de mídia).

`CRON_SECRET` é opcional: num servidor sempre ligado os jobs agendados rodam por timer em processo
(`IN_PROCESS_JOBS`, padrão ligado). Tire a instância do secret `CRON_TARGETS` do GitHub.

Trocar `AUTH_SECRET` desloga todo mundo e invalida URLs de mídia assinadas já emitidas (expiram em
1 h de qualquer forma).

## 3. Login Microsoft

No app registration do Entra, adicione o redirect URI
`https://<dominio>/api/auth/callback/microsoft-entra-id`. Confira a validade do client secret.

## 4. Migração a partir da Vercel

1. **Banco** — com o Postgres criado, no terminal do container do Postgres:
   ```bash
   pg_dump --no-owner --no-privileges -Fc "<url do banco de origem>" > /tmp/origem.dump
   pg_restore --no-owner --no-privileges --clean --if-exists -d "postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" /tmp/origem.dump
   ```
   Depois, no container da aplicação: `npm run db:update`.
2. **Mídia** — no container da aplicação, com o volume montado e `BLOB_READ_WRITE_TOKEN` ainda
   definido: `npm run media:migrate-to-filesystem` (simulação), depois `-- --apply`. Detalhes em
   `docs/media/filesystem-storage.md`.
3. **Validar** no domínio novo: login, biblioteca de mídia (imagem pública e arquivo restrito),
   upload novo, e as telas dos plugins da instância.
4. **Cutover** — congele edições na instância antiga, repita os passos 1 e 2 (o 2 só baixa o que
   for novo), aponte o DNS definitivo e só então desligue o projeto da Vercel.
