# Migrations compatíveis (expand/contract)

As migrations do core e dos plugins instalados rodam no `prebuild` (`scripts/migrate-on-build.mjs`),
**antes** do código novo entrar no ar. Durante o build, e até a Vercel trocar o deploy, o código
antigo continua servindo requisições contra o schema já migrado. Se o deploy falhar depois da
migration, o código antigo continua no ar indefinidamente — com o schema novo.

Por isso toda migration precisa funcionar com **as duas versões do código**: a que está no ar e a
que está entrando.

## Quando as migrations rodam

| Ambiente | Comportamento |
| --- | --- |
| Produção (Vercel, `VERCEL_ENV=production`) e self-hosted | Roda no `prebuild`. Falha derruba o build; o deploy anterior continua no ar. |
| Preview (Vercel, `VERCEL_ENV=preview`) | **Não roda** por padrão — o preview costuma apontar pro banco de produção. Com banco próprio de preview, defina `MIGRATE_ON_PREVIEW=true` nas env vars de Preview. |
| Qualquer um, com `SKIP_DB_MIGRATIONS=true` | Não roda (pra pipelines que migram numa etapa de release separada). |
| Local | `npm run db:update` depois de todo merge (ver `AGENTS.md` §5). |

Um preview sem migrations roda o código do branch contra o schema de produção: se o branch depende
de coluna/tabela nova, a tela que usa isso quebra só no preview. É o preço de não alterar produção
a partir de um branch não aprovado.

## Regra: expandir primeiro, contrair depois

Uma mudança que remove ou renomeia algo vira **dois releases**:

1. **Expand** (release N): adiciona o novo sem tirar o velho. O código novo passa a escrever nos
   dois (ou só no novo, se o velho aceitar ficar desatualizado) e a ler do novo com fallback.
2. **Contract** (release N+1, depois que N está no ar em todas as instâncias): remove o velho.

### Receitas

| Mudança | Release N (expand) | Release N+1 (contract) |
| --- | --- | --- |
| Adicionar coluna | `ADD COLUMN` **nullable** ou com `DEFAULT`. Nunca `NOT NULL` sem default: o código antigo faz `INSERT` sem ela. | Se precisar, `SET NOT NULL` depois de preencher as linhas antigas. |
| Remover coluna | Código para de ler e de escrever a coluna (e o schema Drizzle deixa de declarar só no N+1). | `DROP COLUMN`. |
| Renomear coluna | `ADD COLUMN nova`; código escreve nas duas e lê da nova com fallback; backfill em SQL. | Código só usa a nova; `DROP COLUMN velha`. |
| Mudar tipo | Mesma receita de renomear (coluna nova com o tipo novo). | Idem. |
| Nova tabela | Livre — o código antigo não a conhece. | — |
| Remover tabela | Código para de usar. | `DROP TABLE`. |
| Índice único novo | Conferir duplicatas antes; guardar a criação (ver `drizzle/0047_performance_indexes.sql`) pra não derrubar o build de uma instância com dados que violam a regra. | — |
| Índice em tabela grande | `CREATE INDEX` trava escrita na tabela enquanto roda. Em tabela grande, prefira uma migration custom com `CREATE INDEX CONCURRENTLY` (fora de transação). | — |
| Novo valor em `CHECK` / enum de texto | Ampliar o `CHECK` primeiro; código novo passa a gravar o valor. | Restringir de novo, se for o caso. |

### O que nunca fazer numa migration só

- `DROP`/`RENAME` de coluna ou tabela que o código no ar ainda usa.
- `ADD COLUMN ... NOT NULL` sem `DEFAULT`.
- Backfill pesado dentro da migration do build (o build tem tempo limite). Faça em lotes por um job
  (`platform/scheduled-jobs`) ou script, e contraia depois.

## Como gerar

- Sempre `npm run db:generate` (ou `drizzle-kit generate --custom` pra SQL próprio). Nunca editar
  `drizzle/meta/_journal.json` nem a tabela `__drizzle_migrations` à mão.
- Pode ajustar o `.sql` gerado quando precisar de guarda (`IF NOT EXISTS`, bloco `DO $$`), mantendo
  o efeito final igual ao que o snapshot descreve.
- Plugin: a pasta `migrations/` do próprio plugin, com a tabela de tracking do plugin
  (`src/platform/plugin-engine/run-plugin-migrations.ts`). A primeira migration roda no install; as
  seguintes, no build de toda instância que tem o plugin instalado.

## Checklist de revisão

- [ ] O código **anterior** continua funcionando com o schema novo?
- [ ] O código **novo** funciona se a migration ainda não rodou (preview sem banco próprio)? Se não,
      o PR avisa.
- [ ] Remoção/renomeação está dividida em expand e contract?
- [ ] Índice único: dá pra existirem duplicatas em alguma instância? A criação está guardada?
- [ ] Nenhum backfill longo dentro da migration.
