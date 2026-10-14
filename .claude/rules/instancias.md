---
paths:
  - "instances/**"
  - "package.json"
  - "package-lock.json"
  - "scripts/**"
  - "vercel.json"
  - ".github/workflows/**"
  - "vitest.plugins.config.ts"
---
# Instâncias (AGENTS.md §8)

8. Instâncias: um branch só (`main`) + `instances/<nome>.json`

Não existe branch por instância. `main` é o único branch de deploy: todo projeto da Vercel
(uma instância = um projeto + um banco) faz deploy de `main` e escolhe o que entra no build pela
env **`VENORE_INSTANCE`**:

- `package.json` declara a **união** dos pacotes `@venore/plugin-*`/`@venore/theme-*` de todas as
  instâncias, com **uma versão por pacote** (`git+https://...#vX.Y.Z`), válida para todas. Um
  único `package-lock.json`, `npm ci` determinístico.
- `instances/<nome>.json` lista as chaves que aquela instância usa —
  `{ "plugins": ["disc"], "themes": ["nestpro", "academy"] }` (chave sem o prefixo do pacote).
- `scripts/lib/instance-packages.ts` filtra as deps pela instância; `gen-plugin-registry.ts`,
  `gen-theme-registry.ts` e `vitest.plugins.config.ts` só enxergam o subconjunto. Só o registro
  gerado decide bundle, rotas, contribuições e migrations — pacote instalado fora da instância
  não entra no build nem roda migration.
- **`VENORE_INSTANCE` vazio ou ausente = "venore vanilla"**: todos os pacotes juntos. É o que
  roda no CI (`check`, `plugins`, `integration`, `smoke`, `e2e`) e no desenvolvimento local por
  padrão. Localmente, `VENORE_INSTANCE` no `.env` também vale (env do shell tem precedência).
- Instância inexistente, JSON inválido ou pacote listado que não está no `package.json` derruba
  o codegen (mesmo sem `--strict`) — nunca sobe em silêncio com o conjunto de outra instância.
  `src/plugins/instance-packages.test.ts` confere todo `instances/*.json` contra o `package.json`;
  o job `instances` do CI roda codegen estrito + typecheck de cada instância.

Fluxos:

- **Atualização de core**: commit em `main`. Todas as instâncias recebem no próximo deploy —
  não há merge para propagar.
- **Nova instância**: criar `instances/<nome>.json`, adicionar ao `package.json` (e
  `npm install`) os pacotes que ainda não estão lá, e no projeto da Vercel definir
  `VENORE_INSTANCE=<nome>` com branch de produção `main`.
- **Bump de plugin/tema**: muda a versão no `package.json` + lock (`chore(<plugin>): bump
  @venore/plugin-<nome> para vX.Y.Z`) e vale para **toda** instância que lista o pacote. O
  updater de tema do admin (`platform/theme-engine/apply-theme-update.ts`) comita em
  `SITE_GITHUB_BRANCH`/`VERCEL_GIT_COMMIT_REF`, ou seja, também em `main`, com o mesmo efeito.
- **Ligar/desligar pacote numa instância**: editar só o `instances/<nome>.json`.
- Trocar o `VENORE_INSTANCE` de um projeto exige novo deploy (o registro é gerado no build).

Arquivos genuinamente de uma instância e inofensivos para as outras (ex: header CSP de
`/ext/erasto-league/*` em `vercel.json`, `scripts/migrate-nestpro-data.ts`) moram em `main` também.
Código de `src/` continua sendo core: nada de `if (VENORE_INSTANCE === "x")` no app — o que varia
por instância é só o conjunto de pacotes.
