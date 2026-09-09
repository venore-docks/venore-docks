-- Custom SQL migration file, put your code below! --

-- NEUTRALIZA A 0034 (docs/plugins-repos-separados-plano.md — "Ainda em aberto") ---------------
--
-- A 0034 (`0034_backfill_extension_install_state.sql`) fazia sentido no modelo antigo, onde todo
-- plugin/tema vivia in-tree no core: uma linha em extension_state só existia se alguém tivesse
-- desabilitado algo, então "backfillar installed_at pra tudo que está no registry hoje" era
-- seguro — o código do plugin JÁ estava no repo, só a migration dele podia estar pendente, e essa
-- pendência era resolvida no mesmo `db:migrate`.
--
-- Depois da extração pra repos separados (cada plugin agora é um pacote @venore/plugin-<key>, e
-- "instalado" passa a exigir rodar a migration PRÓPRIA do pacote via
-- platform/plugin-engine/install-plugin.ts, nunca mais no vercel-build), esse INSERT virou uma
-- landmine: QUALQUER banco que roda `db:migrate` (todo `vercel-build`, mesmo sem nenhum
-- @venore/plugin-* nas dependencies) grava academy/birthdays/donations/broadcast/
-- enrollment-dashboard como installed_at preenchido. Se, depois, alguém adiciona de fato
-- @venore/plugin-academy ao package.json e faz deploy, registerPlugins() já enxerga
-- installed=true (linha pré-existente) — install-plugin.ts pula runPluginMigrations() (bloco
-- "if (!alreadyInstalled)"), o plugin aparece "ativo" (contribui navegação/notificação/redirect de
-- aluno) SEM o schema dele existir. Sintoma real: aprenda-musica em produção — "/" redirecionando
-- pra "/academy" e a página quebrando com "relation academy.courses does not exist".
--
-- O QUE ESTA MIGRATION FAZ:
--   Uma migration já aplicada é imutável (mesmo raciocínio da 0032) — não dá pra "neutralizar a
--   0034 in-place". Em vez disso, desfaz o efeito dela: zera installed_at das linhas que a 0034
--   inseriu, pras chaves exatas que ela hardcodou. Seguro mesmo pra quem já instalou de verdade
--   depois: a migration do plugin (runPluginMigrations) já é idempotente (o drizzle-orm migrator
--   pula arquivo já aplicado, via `<plugin>_migrations.__drizzle_migrations` própria) — o pior
--   caso é precisar clicar "Instalar" de novo em /admin/plugins, sem efeito destrutivo. Zera só
--   installed_at (não apaga a linha) pra preservar um `enabled=false` que alguém já tenha
--   configurado — "available" (installed_at NULL) é o estado neutro correto de onde o fluxo real
--   de instalação parte. Não toca `('theme', 'venore-slime', ...)`: é o fallback in-tree
--   obrigatório (AGENTS.md §3), sempre genuinamente "instalado", sem migration própria.

UPDATE "extensions"."extension_state"
SET "installed_at" = NULL
WHERE "kind" = 'plugin'
  AND "key" IN ('academy', 'birthdays', 'donations', 'broadcast', 'enrollment-dashboard');
--> statement-breakpoint

UPDATE "extensions"."extension_state"
SET "installed_at" = NULL
WHERE "kind" = 'theme'
  AND "key" IN (
    'venore-basic', 'venore-nightcity', 'venore-kazordoon', 'venore-pulse', 'venore-frost',
    'menonita-classic', 'aprenda-musica'
  );
