import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Fixtures da regra plugin -> plugin (boundaries/dependencies). Um deles viola a regra DE
    // PROPÓSITO, então nunca entram no `npm run lint` normal — só são lintados
    // programaticamente por src/platform/page-builder/cross-plugin-boundary.eslint.test.ts
    // (que passa `ignore: false`). Não são plugins de verdade: fora do PLUGIN_REGISTRY.
    "src/plugins/_fixture-*/**",
    // Gerado por scripts/gen-plugin-registry.ts (postinstall/predev/prebuild).
    "src/plugins/*.generated.ts",
  ]),
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: { boundaries },
    settings: {
      // Elements classify by folder ("context" / "plugin" / "theme"); files classify
      // by category within a context/plugin. "*-public" (exclusive) covers
      // index.ts and contracts/**; everything else falls through to the
      // "*-internal" catch-all. The dependency rules below disallow
      // plugins/themes reaching "context-internal" files, and a plugin
      // reaching another plugin's "plugin-internal" files (`pluginName`
      // capture tells "another plugin" from "the same plugin").
      "boundaries/elements": [
        { type: "context", pattern: "src/contexts/*", partialMatch: false },
        { type: "plugin", pattern: "src/plugins/*", capture: ["pluginName"], partialMatch: false },
        { type: "theme", pattern: "src/themes/*", partialMatch: false },
        { type: "observability", pattern: "src/observability", partialMatch: false },
        { type: "platform", pattern: "src/platform/*", partialMatch: false },
        { type: "component", pattern: "src/components", partialMatch: false },
        // Kit de tema da v8 (o venore-slime de hoje, spec §11): só contratos de tema, ui e shared.
        { type: "theme-kit", pattern: "src/theme-sdk/kit", partialMatch: false },
      ],
      "boundaries/files": [
        // O contrato de slot (contexts/themes/contracts/**) é a ÚNICA superfície de context que
        // um tema pode importar — categoria própria, antes da regra genérica de context-public,
        // pra a policy "theme -> context" abaixo poder barrar barrel/contracts de qualquer OUTRO
        // context sem barrar o contrato de tema (só tipos). Ver docs/themes/shell-contract.md §5.6.
        { pattern: "src/contexts/themes/contracts/**", category: "theme-contract", exclusive: true },
        { pattern: "src/contexts/*/index.ts", category: "context-public", exclusive: true },
        { pattern: "src/contexts/*/contracts/**", category: "context-public", exclusive: true },
        { pattern: "src/contexts/*/**", category: "context-internal" },
        { pattern: "src/plugins/*/index.ts", category: "plugin-public", exclusive: true },
        { pattern: "src/plugins/*/contracts/**", category: "plugin-public", exclusive: true },
        { pattern: "src/plugins/*/**", category: "plugin-internal" },
        { pattern: "src/observability/index.ts", category: "observability-public", exclusive: true },
        { pattern: "src/observability/contracts/**", category: "observability-public", exclusive: true },
        { pattern: "src/observability/**", category: "observability-internal" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: { element: { type: "plugin" } },
              disallow: {
                to: {
                  element: { type: "context" },
                  file: { categories: "context-internal" },
                },
              },
              message:
                "Um plugin só pode importar de contexts/<nome>/index.ts (barrel público) ou contexts/<nome>/contracts/** — nunca de arquivos internos do context (store, service fora do barrel, schema, etc).",
            },
            {
              // Tema é MAIS restrito que plugin: nem barrel público de context ele importa. A
              // única superfície permitida é o contrato de slot (categoria "theme-contract",
              // contexts/themes/contracts/**, só tipos). Com a Abordagem A o Shell tem muita
              // árvore de JSX própria (docs/themes/shell-contract.md) — a regra "o tema nunca
              // busca dado sozinho, só recebe por prop" precisa de trava mecânica, não só de
              // convenção. platform/theme-rendering é o único lugar que resolve dado pro tema.
              from: { element: { type: "theme" } },
              disallow: {
                to: {
                  element: { type: "context" },
                  file: { categories: ["context-internal", "context-public"] },
                },
              },
              message:
                "Um tema só pode importar o contrato de slot (src/contexts/themes/contracts/**) — nunca um barrel público nem arquivo interno de context. O tema recebe todo dado por prop do Shell, resolvido em platform/theme-rendering (docs/venore-docks.md — Contrato de slot).",
            },
            {
              // v8 (spec §11): tema não importa platform/ nem plugin — dado chega por prop, e o que
              // um pacote de tema precisa do core vem de @venore/theme-sdk.
              from: { element: { type: "theme" } },
              disallow: { to: { element: { type: ["platform", "plugin"] } } },
              message:
                "Um tema não importa src/platform/** nem src/plugins/** (spec v8 §11) — o dado chega por prop resolvido em platform/theme-rendering; utilitários do core vêm de @venore/theme-sdk.",
            },
            {
              // Kit de tema (src/theme-sdk/kit/**): pode importar contratos de tema
              // (contexts/themes/contracts/**), @/components/ui/** e src/shared/** — nunca
              // platform/, plugins nem context (barrel ou interno).
              from: { element: { type: "theme-kit" } },
              disallow: [
                { to: { element: { type: ["platform", "plugin"] } } },
                { to: { element: { type: "context" }, file: { categories: ["context-internal", "context-public"] } } },
              ],
              message:
                "O kit de tema (src/theme-sdk/kit/**) só importa contratos de tema, @/components/ui/** e src/shared/** — nunca platform/, plugins ou context (spec v8 §11).",
            },
            {
              // Um plugin importa de OUTRO plugin só pelo barrel público (index.ts) ou
              // contracts/** — nunca de arquivo interno (components, features, blocks, routes,
              // shared). O capture `pluginName` distingue "outro plugin"
              // (`!{{ from.pluginName }}`) de "o próprio plugin" (imports relativos internos
              // seguem livres). Um plugin que
              // depende de outro declara `dependencies` no manifesto e consome só a superfície
              // pública — mesma disciplina que já vale entre contexts.
              from: { element: { type: "plugin" } },
              disallow: {
                to: {
                  element: { type: "plugin", captured: { pluginName: "!{{ from.pluginName }}" } },
                  file: { categories: "plugin-internal" },
                },
              },
              message:
                "Um plugin só pode importar de src/plugins/<outro>/index.ts (barrel público) ou src/plugins/<outro>/contracts/** — nunca de arquivos internos de outro plugin. Exponha o que precisa no index.ts do plugin-alvo (ou mova pra contracts/) e declare a dependência no manifesto.",
            },
            {
              from: { element: { type: ["context", "plugin"] } },
              disallow: {
                to: {
                  element: { type: "observability" },
                  file: { categories: "observability-internal" },
                },
              },
              message:
                "Observability é consumida via porta/adapter — importe só de observability/index.ts (barrel público), nunca de buffer, flush, config ou do schema do banco internos.",
            },
            {
              from: { element: { type: "platform" } },
              disallow: {
                to: {
                  element: { type: "context" },
                  file: { categories: "context-internal" },
                },
              },
              message:
                "platform/ só pode importar de contexts/<nome>/index.ts (barrel público) ou contexts/<nome>/contracts/** — nunca de arquivos internos do context (store, service fora do barrel, schema, etc), mesma regra que já vale pra plugin/tema.",
            },
            {
              from: { element: { type: "component" } },
              disallow: { to: { element: { type: "plugin" } } },
              message:
                "src/components não pode importar de src/plugins/* — um plugin contribui pro page-builder via platform/page-builder (block-registry.ts + block-renderers.tsx), nunca direto num componente do core.",
            },
          ],
        },
      ],
    },
  },
  {
    // Cor deve vir sempre dos tokens semânticos shadcn (bg-card, text-foreground,
    // text-muted-foreground, border-border, text-destructive, text-warning, etc.)
    // — nunca de classes Tailwind de paleta cru, nem do vocabulário próprio já eliminado
    // (bg-surface-*, text-text-*, border-border-*, accent-soft, info-*). Ver AGENTS.md —
    // "Vocabulário de cor — migração pra shadcn".
    files: [
      "src/app/**/*.{js,jsx,ts,tsx}",
      "src/themes/**/*.{js,jsx,ts,tsx}",
      "src/components/**/*.{js,jsx,ts,tsx}",
      "src/plugins/**/*.{js,jsx,ts,tsx}",
      "src/platform/**/*.{js,jsx,ts,tsx}",
      // Kit de tema da v8 (ex-componentes do venore-slime, movidos de src/themes/).
      "src/theme-sdk/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/\\b(bg-white|text-white|bg-gray-[0-9]+|text-gray-[0-9]+|border-gray-[0-9]+|text-red-[0-9]+|bg-red-[0-9]+|border-red-[0-9]+|text-blue-[0-9]+|bg-blue-[0-9]+|border-blue-[0-9]+|text-green-[0-9]+|bg-green-[0-9]+|border-green-[0-9]+|text-amber-[0-9]+|bg-amber-[0-9]+|border-amber-[0-9]+|bg-surface-[a-z]+|text-text-[a-z]+|border-border-[a-z]+|accent-soft|(bg|text|border)-info(-[a-z]+)?)\\b/]',
          message:
            "Não use cores Tailwind cruas (bg-white, text-gray-*, border-gray-*, text-red-*, text-blue-*, text-green-*, bg-amber-*, ...) nem o vocabulário de cor próprio já eliminado (bg-surface-*, text-text-*, border-border-*, accent-soft, info-*) — use os tokens semânticos shadcn (bg-card, bg-muted, text-foreground, text-muted-foreground, text-muted-foreground/56, border-border, border-ring, bg-accent/14, text-destructive, text-warning, bg-primary/text-primary-foreground, etc).",
        },
        {
          selector:
            'JSXAttribute[name.name="className"] TemplateElement[value.raw=/\\b(bg-white|text-white|bg-gray-[0-9]+|text-gray-[0-9]+|border-gray-[0-9]+|text-red-[0-9]+|bg-red-[0-9]+|border-red-[0-9]+|text-blue-[0-9]+|bg-blue-[0-9]+|border-blue-[0-9]+|text-green-[0-9]+|bg-green-[0-9]+|border-green-[0-9]+|text-amber-[0-9]+|bg-amber-[0-9]+|border-amber-[0-9]+|bg-surface-[a-z]+|text-text-[a-z]+|border-border-[a-z]+|accent-soft|(bg|text|border)-info(-[a-z]+)?)\\b/]',
          message:
            "Não use cores Tailwind cruas (bg-white, text-gray-*, border-gray-*, text-red-*, text-blue-*, text-green-*, bg-amber-*, ...) nem o vocabulário de cor próprio já eliminado (bg-surface-*, text-text-*, border-border-*, accent-soft, info-*) — use os tokens semânticos shadcn (bg-card, bg-muted, text-foreground, text-muted-foreground, text-muted-foreground/56, border-border, border-ring, bg-accent/14, text-destructive, text-warning, bg-primary/text-primary-foreground, etc).",
        },
      ],
    },
  },
]);

export default eslintConfig;
