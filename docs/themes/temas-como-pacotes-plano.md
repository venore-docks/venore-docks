# Temas como pacotes `@venore/theme-*` — plano

Mesmo modelo dos plugins (`docs/plugins-repos-separados-plano.md`): cada tema vira um pacote npm
instalável via git-dependency; o core traz só os que a instância quer. **`venore-slime` NUNCA
sai do core** — é o fallback obrigatório do sistema de temas (AGENTS.md §3), então continua em
`src/themes/venore-slime/` e hardcoded em `globals.css` / `registry.ts`. São **7 repos** (todos
menos o slime).

Status: **implementado** (atualizado em 2026-09-30). `@venore/theme-sdk` (alias de tsconfig para
`src/theme-sdk/`) e `scripts/gen-theme-registry.ts` existem; os temas extras de `main` são pacotes
`@venore/theme-*` fixados por tag no `package.json` (academy, aurora, druids, fearless, halo,
knights, nebula, nimbus, nite, paladins, sorcerers, vega, volt) — a lista de 7 temas abaixo é a do
plano original. Texto original: "não iniciado; as 10 outras sugestões de tema já estão em `main`".

## Por que é uma sessão própria

- Toca o pipeline de build (Tailwind v4 resolvendo `@import` de CSS dentro de `node_modules`),
  não só TS.
- Exige criar 7 repos Git e mover ~250 arquivos (`components/*.tsx` de 5 temas + `theme.css` +
  `manifest.ts` + `color-palettes.ts` + `index.ts` de cada).
- O plugin equivalente levou várias sessões, uma por plugin.

## Peças no core (fazer primeiro, sem repos ainda)

1. **`@venore/theme-sdk` como alias de tsconfig** (não pacote publicado, igual `@venore/plugin-sdk`)
   → `src/contexts/themes/contracts/` (ou um `src/theme-sdk/` que reexporta `contracts/types` +
   `contracts/contract-version`). Os temas extraídos importam `import type { ThemeManifest } from
   "@venore/theme-sdk"` no lugar de `@/contexts/themes/contracts/types`. Adicionar em
   `tsconfig.json` `compilerOptions.paths` e no alias do `vitest.config.ts`.

2. **`scripts/gen-theme-registry.ts`** (espelha `gen-plugin-registry.ts`): lê `package.json` →
   deps `@venore/theme-*` (menos `-sdk`), `canResolve(`${dep}/manifest`)`, e gera (gitignored):
   - `src/themes/registry.generated.ts` — `GENERATED_THEME_REGISTRY: Record<string,
     ThemeRegistryEntry>` importando `<camel>Manifest` de `@venore/theme-<key>/manifest`,
     `Shell` do barrel, `<CONST>_COLOR_PALETTES` de `@venore/theme-<key>/color-palettes`.
   - `src/themes/theme-imports.generated.css` — uma linha `@import "@venore/theme-<key>/theme.css";`
     por tema.
   - Rodar nos hooks `pre*` (postinstall/predev/prebuild/pretypecheck/pretest), junto com
     `gen-plugin-registry`.

3. **`src/themes/registry-types.ts`** — mover `ThemeShellComponent` e `ThemeRegistryEntry` pra cá
   (hoje em `registry.ts`), pra `registry.ts` e `registry.generated.ts` importarem sem ciclo.

4. **`src/themes/registry.ts`** — mantém `venore-slime` hardcoded; `THEME_REGISTRY = {
   "venore-slime": {...}, ...GENERATED_THEME_REGISTRY }`. Os outros 7 imports estáticos saem
   daqui conforme cada um vira pacote.

5. **`src/app/globals.css`** — mantém `@import "../themes/venore-slime/theme.css";`; adiciona
   `@import "../themes/theme-imports.generated.css";` logo depois. **VERIFICAR** que o Tailwind v4
   resolve `@import "@venore/theme-<key>/theme.css"` via `node_modules` (o `exports` do pacote
   precisa expor `"./theme.css"`). O repo já faz `@import "tw-animate-css"` (pacote), então o
   resolver de pacote existe — mas CSS de subpath com `exports` é o ponto a provar. Plano B se
   não funcionar: o codegen concatena os `theme.css` num único
   `src/themes/theme-bundle.generated.css` lido de `node_modules` em build-time (perde o
   `@import`, mantém o resultado).

6. **`next.config.ts`** — o filtro de `transpilePackages` já pega `@venore/plugin-*`; estender pra
   `@venore/theme-*` também (`dep.startsWith("@venore/") && !dep.endsWith("-sdk")`).

7. **`eslint.config.mjs`** — `boundaries/elements` tem `{ type: "theme", pattern: "src/themes/*" }`.
   Um tema em `node_modules/@venore/theme-*` não casa esse pattern, então a regra `theme ->
   context` (categoria `theme-contract`) deixa de valer pra ele. Aceitável no curto prazo (o
   pacote é revisado no repo próprio); registrar como Known Gap ou adicionar
   `node_modules/@venore/theme-*` como `external` no boundaries.

8. **`.gitignore`** — `src/themes/registry.generated.ts`, `src/themes/theme-imports.generated.css`.

## Por tema (7×, um repo cada)

Receita (idêntica à dos plugins):

1. `mkdir ../venore-theme-<key>`, `git init`, copiar `src/themes/<key>/**`.
2. `package.json`: `name "@venore/theme-<key>"`, `exports` (`.` → `index.ts`, `./manifest`,
   `./color-palettes`, `./theme.css`, `./components/*`), `peerDependencies` (`react`,
   `react-dom`, `lucide-react`, `next`), `sideEffects: ["*.css"]`.
3. Codemod de imports: `@/contexts/themes/contracts/types` → `@venore/theme-sdk`;
   `@/platform/nav-icons/NavIcon` → **problema**: temas importam `@/platform/nav-icons`. Ou (a)
   `NavIcon` também vira parte do `@venore/theme-sdk`, ou (b) o tema recebe o componente de ícone
   por prop do contrato de slot. Decidir antes de extrair (afeta `menonita-classic`,
   `venore-nightcity`, `venore-slime`... slime fica no core então só os 2 primeiros).
4. Imports internos do tema continuam relativos.
5. `venore-frost` importa `../venore-pulse/components/Shell` — dependência entre temas. Ou frost
   declara `@venore/theme-pulse` como dep e importa do barrel, ou frost ganha Shell própria (cópia).
6. `git commit`, adicionar `"@venore/theme-<key>": "file:../venore-theme-<key>"` nas
   `dependencies` do core, `npm install`, rodar codegen, `typecheck`/`lint`/`test`/`build`.
7. Remover `src/themes/<key>/` do core e o import estático de `registry.ts` / `globals.css`.
8. Quando for pro deploy: `git remote add`, push, tag `v1.0.0`, trocar `file:../` por
   `github:<org>/venore-theme-<key>#v1.0.0`.

Ordem sugerida: `venore-basic` (tier 1, menor, prova o pipeline) → `venore-pulse` →
`venore-frost` (depende do pulse) → `venore-kazordoon` → `venore-nightcity` → `menonita-classic`
→ `aprenda-musica` (maior).

## Ganho

Uma instância cliente com 1 tema para de embarcar 8 blocos de `theme.css` + 5 árvores de
componentes de Shell no bundle. `globals.css` e `registry.ts` deixam de crescer a cada tema novo.
