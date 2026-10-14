---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "src/themes/**"
  - "src/theme-sdk/**"
  - "src/platform/theme-*/**"
  - "e2e-themes/**"
  - "scripts/gen-theme-registry.ts"
  - "scripts/theme-check.ts"
---
# Convenções de CSS / tokens (AGENTS.md §3)

- **Nenhuma decisão de design (cor, raio, sombra, espaçamento, tipografia, peso, duração, curva
  de easing, proporção de escala) pode ser declarada em `src/app/globals.css`.** Esse arquivo só
  CONSOME variáveis via `var(...)`; quem define valor é sempre um tema, em
  `src/themes/<tema>/theme.css`, sob os seletores `[data-theme="<tema>"]` /
  `[data-theme="<tema>"].dark`. O `THEME_REGISTRY` (`src/themes/registry.ts`) hoje tem só o
  `venore-slime` hardcoded (fallback obrigatório, `src/themes/venore-slime/`); todo tema extra é
  um pacote `@venore/theme-*` descoberto a partir das deps do `package.json` (filtradas por
  `VENORE_INSTANCE`, seção 8)
  (`scripts/gen-theme-registry.ts` → `registry*.generated.ts`, `theme-imports.generated.css`,
  `theme-lineage.generated.css`, `theme-tokens.generated.ts`, todos gitignored). Cada tema
  redeclara o mesmo vocabulário sob o seu próprio `[data-theme="..."]`, nunca por cima de outro.
  `venore-slime` (`src/themes/venore-slime/theme.css`) é a referência: o único com o vocabulário
  completo garantido e o fallback imutável (ver abaixo). Isso vale inclusive para o vocabulário
  shadcn (`--background`, `--primary`, etc.) e para os multiplicadores de escala usados em
  `calc()` (ex: `--ui-radius-scale-lg: 2`, `--ui-button-padding-scale-xs: 0.5`) — o número da
  proporção é decisão de design tanto quanto a cor.
- **Contrato de tema 8.0.0** (`docs/themes/theme-system-v8.md` — leitura obrigatória antes de
  mexer em tema, kit ou `platform/theme-rendering`). O registro aceita contrato 7.x (Shell inteiro,
  via `LegacyShellAdapter`) e 8.x (`defineTheme`, `@/theme-sdk/define`). O `venore-slime` **é o
  kit** (`src/theme-sdk/kit/`: regiões, layouts `topbar`/`rail`, templates, estados, i18n): um tema
  v8 declara manifesto, tokens e só as regiões/templates que diferem. O kit só importa contratos
  de tema, `@/components/ui/**` e `src/shared/**`, e usa só propriedades lógicas (`ms-`/`ps-`/
  `border-s`/`start-`; `logical-properties.test.ts` com baseline `{}`). Tokens por região
  (`--region-*`, `--section-*`) têm defaults só com `var()` em `src/app/styles/region-tokens.css`;
  o layout por página (`data-page-*` + `src/app/styles/page-layout.css`) idem. Texto de região e
  template vem dos catálogos `kit/i18n/messages/*` via `t()`; data via `formatDate`
  (`src/shared/format-date.ts`), nunca `"pt-BR"` fixo. Config de tema (tema, paleta, opções,
  fontes, seções) é `theme.config` + rascunho/histórico em `themes.theme_config_revisions`,
  editada em `/admin/themes/customize`. Admin nunca é tematizado.
- Gate de tema: `npm run theme:check` (codegen estrito, contrato de tokens, contraste por região,
  orçamento, harness SSR e Playwright a 390×844/1280×800). Dívida de pacote 7.x fica em baselines
  catraca (`src/themes/a11y-baseline.json`, `src/themes/theme-ssr.baseline.json`,
  `e2e-themes/a11y-baseline.json`); o `venore-slime` e todo tema v8 não podem ter dívida. Mudança
  de markup do kit atualiza os snapshots de paridade (`src/themes/venore-slime/__parity__/`) no
  mesmo commit.
- Prova executável: `src/app/globals.no-design-values.test.ts` falha se um literal de design
  (hex, `oklch()`/`rgb()`/`color-mix()`, `cubic-bezier()`, gradiente, `px`/`rem`/`em`, duração)
  reaparecer em `globals.css`.
- **`venore-slime` é o tema oficial e fallback do sistema — nunca deve ser removido/deletado**
  de `src/themes/registry.ts` nem apagado do disco, independente de quantos outros temas estejam
  instalados. Os demais temas do registry redeclaram o mesmo vocabulário (`--background`,
  `--primary` etc.) sob seu próprio `[data-theme="..."]`, nunca por cima do `venore-slime`.
- Vocabulário de cor único do projeto é o do **shadcn** (`bg-card`, `bg-muted`, `text-foreground`,
  `text-muted-foreground`, `text-muted-foreground/56`, `border-border`, `border-ring`,
  `bg-accent/14`, `text-destructive`, `text-warning`, `bg-primary`/`text-primary-foreground`).
  Cores são declaradas em `oklch(...)` no `theme.css` de cada tema (ex:
  `src/themes/venore-slime/theme.css`), nunca hex/rgb novo, e nunca em `globals.css`.
- O vocabulário próprio anterior (`surface-*`, `text-text-*`, `border-subtle/default/strong`,
  `accent-soft`, `info-*`) foi eliminado de `src/` e não deve reaparecer — ver a tabela de
  mapeamento completa logo abaixo se precisar reconstituir um valor antigo.
- `--warning-*` (`text-warning`/`bg-warning-soft`/`border-warning-border`) é o único token
  semântico próprio que sobrevive à migração — sem equivalente shadcn, usado no admin do core
  (ex: `src/app/(platform)/admin/cms/**`, `admin/media/**`) e nos blocos do page-builder.
- **Nada de valor hardcoded** de cor/espaçamento/raio em componente de página, tema ou plugin —
  regra do documento de arquitetura. Só a parte de **cor** tem enforcement mecânico hoje
  (`no-restricted-syntax` em `eslint.config.mjs`, cobrindo `src/app`, `src/themes`,
  `src/components`, `src/plugins`, `src/platform`) mais o teste de `globals.css` acima. Raio
  (`rounded-*`) e espaçamento (`p-*`, `gap-*`) **não têm lint bloqueando valor cru** hoje — tratar
  como regra manual até existir enforcement (ver Known Gaps).
- Radius: escala derivada de uma única variável (`--radius: 0.2rem`, declarada no tema) via
  `calc()` em `@theme inline` de `globals.css` (`--radius-sm` a `--radius-4xl`), multiplicada
  pelas proporções `--ui-radius-scale-*` (também declaradas no tema) — não valores soltos por
  componente.
- **`src/components/ui/**` (primitivos shadcn stock) não é editado diretamente.** Customização
  visual sobre um primitivo vive fora dele (ex: seletor `[data-slot="button"]` em `globals.css`),
  para sobreviver a uma reinstalação via `shadcn` CLI. Exceção: `border-input` continua correto
  *dentro* dos primitivos de formulário — é convenção de scaffold do shadcn, não uma tradução
  pendente de `border-strong`.

### Tabela de migração (referência para valores antigos)

| token próprio | shadcn | observação |
|---|---|---|
| `surface-base` / `surface-canvas` | `background` | |
| `surface-panel` | `card` | |
| `surface-elevated` / `surface-subtle` | `muted` | |
| `surface-overlay` | `popover` (+ `/80` quando é scrim: `Dialog`, `MobileNavDrawer`) | |
| `text-primary` | `foreground` | |
| `text-secondary` / `text-muted` | `muted-foreground` | |
| `text-tertiary` | `muted-foreground` + `/56` fixo | replica `color-mix` antigo, pixel-idêntico |
| `text-accent` | `primary` | troca de papel, não de opacidade |
| `border-subtle` | `border` | |
| `border-default` / `border-strong` | `ring` (não `input`) | `--border-strong` == `--ring` numericamente |
| `accent-soft` | `accent` + `/14` fixo | nunca `bg-accent` sólido no lugar |
| `info-*` | `border-border bg-secondary text-secondary-foreground` | sem papel "info" no shadcn |
| `rounded-control` | `rounded-xl` | |
| `header-*`, `app-bg-*`/`app-background` | não migram — identidade do Venore Slime | `src/themes/venore-slime/theme.css` |
