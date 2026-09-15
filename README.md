# Venore

Plataforma de site institucional + CMS com sistema de plugins e temas, construída sobre Next.js
(App Router). A arquitetura — camadas obrigatórias, fronteiras entre `contexts`/`plugins`/`themes`,
RBAC, tokens de design — está descrita em [`docs/venore-docks.md`](docs/venore-docks.md) (o *porquê*)
e em [`AGENTS.md`](AGENTS.md) (o *que fazer ao escrever código aqui*).

> **Este não é o Next.js que você conhece.** Esta cópia do Next tem mudanças de API e convenção em
> relação ao upstream — antes de escrever código, leia o guia relevante em
> `node_modules/next/dist/docs/`.

## Requisitos

- **Node.js 20.9+**
- **PostgreSQL 14+** (um banco vazio já basta — o instalador cria o schema)
- npm

## Configuração

```bash
npm install
cp .env.example .env
```

Edite o `.env`. Para subir o projeto do zero bastam duas variáveis:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Conexão com o Postgres (`postgres://user:pass@host:5432/db`) |
| `AUTH_SECRET` | Segredo do Auth.js — gere com `npx auth secret` ou `openssl rand -base64 32` |

Todas as outras entradas do [`.env.example`](.env.example) são opcionais: provedores OAuth
(Google / GitHub / Microsoft), banco isolado de teste de integração (`TEST_DATABASE_URL`), driver
de mídia, chave da API de notícias do plugin broadcast. Sem nenhum OAuth configurado, o login por
email + senha (provider *Credentials*) é o único caminho — e é o que o instalador abaixo prepara.

## Instalação inicial

Com o `.env` pronto e o Postgres acessível:

```bash
npm run db:install:fresh
```

O script roda, nesta ordem:

1. `drizzle-kit migrate` do core (cria o schema de core + `contexts`);
2. semeia os papéis de sistema (`superadmin` / `admin` / `member`) e as permissions base do `admin`;
3. registra os plugins declarados em código (grava os defaults de `settings` dos plugins ativos);
4. cria o primeiro usuário com o email + senha informados e concede a ele o papel `superadmin`.

O email e a senha podem vir como argumentos (`npm run db:install:fresh -- admin@exemplo.com
suaSenha`), pelas variáveis `INSTALL_ADMIN_EMAIL` / `INSTALL_ADMIN_PASSWORD`, ou por prompt
interativo. O script é idempotente nas etapas 1–3 e **aborta com aviso se já existir um
superadmin** — nesse caso a instalação já foi feita; para promover outra pessoa use `/admin/rbac`
ou `npm run db:bootstrap-superadmin -- <email>`.

Feito isso, suba o servidor e faça login em `/login`:

```bash
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

## Atualizando uma instância

Cada site é um fork do boilerplate (ver `VENORE-DOCKS.md` do workspace) que traz melhorias via
`git fetch upstream && git merge upstream/main`. Depois de todo merge:

```bash
npm install       # instala dependências novas/atualizadas (plugins/temas incluídos)
npm run db:update # aplica tudo que o merge pode ter trazido de banco
```

`db:update` roda, nesta ordem: migrations do core, papéis/permissions base do RBAC (qualquer
permission nova que o merge tenha adicionado já é concedida ao papel `admin` aqui — não precisa de
comando extra por permission), defaults de settings de plugin, e migrations pendentes de cada
plugin com schema já instalado. Todas as etapas são idempotentes — rodar de novo sem nada pendente
não faz mal. Depois é só (re)deployar/reiniciar o servidor normalmente.

## Plugins

O `vercel-build` e o `npm run db:migrate` cobrem só as migrations do core. **As migrations de cada
plugin rodam quando o plugin é instalado** pela tela `/admin/plugins` (ou, em produção, no passo de
install), nunca no build. Enquanto um plugin está apenas "disponível" (presente no código, sem
estado de instalação), ele não contribui rota, permission, bloco nem setting, e seu schema não é
criado. Detalhes em [`docs/venore-docks.md`](docs/venore-docks.md) — *Sistema de plugins*.

## Comandos

Referência completa em [`AGENTS.md`](AGENTS.md) seção 5. Os mais usados:

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint (inclui as regras de fronteira e de cor) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest — testes unitários (`*.test.ts`, sem banco) |
| `npm run test:integration` | Vitest de integração (`*.integration.test.ts`, exige `TEST_DATABASE_URL`) |
| `npm run db:generate` / `npm run db:migrate` | Drizzle Kit — schema do core |
| `npm run db:install:fresh` | Instalação inicial (ver acima) |
| `npm run db:update` | Atualizar uma instância existente depois de um merge (ver acima) |
