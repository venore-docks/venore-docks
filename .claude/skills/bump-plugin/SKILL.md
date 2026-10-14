---
name: bump-plugin
description: Atualiza a versão de um pacote @venore/plugin-* ou @venore/theme-* no core (package.json + lockfile), valida e comita. Use quando pedirem "bump", "atualizar o plugin X para vY" ou "subir a versão do tema".
---

# Bump de plugin/tema no core

Tarefa curta: rode em sessão própria, effort medium. Não leia o código do plugin; o bump só troca a referência.

1. Confirme que a tag existe (sem clonar):
   `git ls-remote --tags https://github.com/venore-docks/venore-<plugin|theme>-<nome>.git | grep -F "v<X.Y.Z>"`.
   Sem tag: pare e peça para criá-la no repositório do pacote (bump por SHA não é o padrão — AGENTS.md §8).
2. Troque a referência mantendo o formato `git+https://github.com/venore-docks/venore-<tipo>-<nome>.git#v<X.Y.Z>`:
   `npm pkg set "dependencies.@venore/<tipo>-<nome>=git+https://github.com/venore-docks/venore-<tipo>-<nome>.git#v<X.Y.Z>"`
3. Regenere o lockfile só para esse pacote: `npm install --no-audit --no-fund --loglevel=error`.
   Confira com `git diff --stat` que só `package.json` e `package-lock.json` mudaram.
4. Valide, em ordem, parando no primeiro erro (saída curta):
   - `npm run gen:registries:strict`
   - `npm run typecheck`
   - plugin: `npm run test:plugins -- --reporter=dot` · tema: `npm run theme:check -- --no-browser`
5. Comite: `chore(<nome>): bump @venore/<tipo>-<nome> para v<X.Y.Z>` (+ uma linha do que muda, se souber).
6. Se a validação falhar por causa do pacote, não "conserte" o core para acomodar: reporte o erro e pare.

Várias atualizações do mesmo plugin no mesmo dia? Prefira iterar com `file:../venore-plugin-<nome>` sem commitar
e fazer um único bump no fim.
