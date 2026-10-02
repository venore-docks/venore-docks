import type { PluginContributions } from "@/platform/plugin-engine/plugin-contributions";

// Fixture (não é um plugin de verdade — fora do PLUGIN_REGISTRY e do `npm run lint`, ver
// eslint.config.mjs). Prova executável dos outlets de tema (spec v8 §7.4, W7): um outlet por
// região, um com `match`, um só de admin, um que lança e um que estoura o timeout. Consumida por
// src/platform/theme-rendering/resolve-theme-outlets.test.tsx.
export const FIXTURE_OUTLETS_PLUGIN_KEY = "fixture-outlets";

export const fixtureOutletsContributions: PluginContributions = {
  outlets: [
    {
      key: "banner",
      outlet: "content.before",
      render: async (ctx) => <p data-fixture-outlet="banner">Aviso do plugin em {ctx.pathname}</p>,
    },
    {
      key: "late",
      outlet: "content.before",
      order: 200,
      render: async () => <p data-fixture-outlet="late">Depois do aviso</p>,
    },
    {
      key: "early",
      outlet: "content.before",
      order: 10,
      render: async () => <p data-fixture-outlet="early">Antes do aviso</p>,
    },
    {
      key: "footer-note",
      outlet: "footer.top",
      render: async () => <p data-fixture-outlet="footer-note">Nota de rodapé do plugin</p>,
    },
    {
      key: "after",
      outlet: "content.after",
      render: async () => <p data-fixture-outlet="after">Depois do conteúdo</p>,
    },
    {
      key: "blog-only",
      outlet: "content.after",
      match: ["blog/:slug"],
      render: async (ctx) => <p data-fixture-outlet="blog-only">Só em post: {ctx.pathname}</p>,
    },
    {
      key: "admin-only",
      outlet: "content.before",
      areas: ["admin"],
      render: async () => <p data-fixture-outlet="admin-only">Só no admin</p>,
    },
    {
      key: "boom",
      outlet: "content.after",
      render: async () => {
        throw new Error("fixture outlet explodiu");
      },
    },
    {
      key: "slow",
      outlet: "content.after",
      render: () => new Promise((resolve) => setTimeout(() => resolve(<p data-fixture-outlet="slow">lento</p>), 5_000)),
    },
  ],
};
