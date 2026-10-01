import { describe, expect, it, vi } from "vitest";
import type { BlockDefinition } from "@/contexts/cms";
import type { BlockRendererComponent } from "./block-renderers";

// vitest resolve sem a condition "react-server" do Next — sem isso, o guard de server-only.ts
// lança ao ser importado. Mock vazio só neste arquivo, sem mexer na condition global do vitest.
vi.mock("server-only", () => ({}));

// block-renderers.tsx importa getMediaAsset de @/contexts/media, cujo barrel sobe até
// @/contexts/auth -> next-auth (não resolve neste ambiente). getMediaAsset nunca é chamado aqui.
vi.mock("@/contexts/media", () => ({
  getMediaAsset: async () => ({ success: false, error: { code: "test", message: "mock" } }),
}));

// Sem plugins no repo: um plugin fingido com UM bloco (definition + renderer) exercita a paridade
// entre block-registry e block-renderers e o loader preguiçoso de blockRenderers.
function fakeLeafDefinition(key: string): BlockDefinition {
  return {
    key,
    label: key,
    category: "plugin",
    structure: "leaf",
    defaultData: {},
    editorFields: [],
    allowedInRoot: true,
  };
}

const fakeRenderer: BlockRendererComponent = () => null;

vi.mock("@/plugins/contributions", () => ({
  PLUGIN_CONTRIBUTIONS: {
    alpha: {
      blockDefinitions: [fakeLeafDefinition("alpha.one")],
      // loader preguiçoso, mesma assinatura que block-renderers.tsx espera
      blockRenderers: async () => ({ "alpha.one": fakeRenderer }),
    },
  },
}));

const { listBlockDefinitions } = await import("./block-registry");
const { listBlockRendererKeys, resolveBlockRenderer } = await import("./block-renderers");

// Guarda de regressão: "adicionei bloco e esqueci o render" (ou vice-versa) vira falha de teste
// em vez de bug só visível em runtime.
describe("paridade entre block-registry e block-renderers", () => {
  it("toda key com definition tem um renderer resolvível", async () => {
    for (const definition of listBlockDefinitions()) {
      expect(await resolveBlockRenderer(definition.key), `sem renderer pra key "${definition.key}"`).not.toBeNull();
    }
  });

  it("toda key com renderer registrado tem uma definition correspondente", async () => {
    const definitionKeys = new Set(listBlockDefinitions().map((definition) => definition.key));
    for (const key of await listBlockRendererKeys()) {
      expect(definitionKeys.has(key), `sem definition pra renderer "${key}"`).toBe(true);
    }
  });
});

describe("core.content.markdown", () => {
  async function renderMarkdown(source: string): Promise<string> {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const renderer = await resolveBlockRenderer("core.content.markdown");
    if (!renderer) throw new Error("sem renderer de markdown");
    const node = await renderer({
      block: { id: "b1", key: "core.content.markdown", slot: "root", htmlId: null, data: { source } } as never,
      mode: "published",
      renderBlocks: async () => [],
    });
    return renderToStaticMarkup(node as never);
  }

  it("renderiza Markdown com GFM (título, tabela, tachado)", async () => {
    const html = await renderMarkdown("# Título\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n~~velho~~");
    expect(html).toContain("<h1>Título</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain("<del>velho</del>");
  });

  it("não renderiza HTML cru nem link javascript:", async () => {
    const html = await renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src=x onerror=alert(1)>');
    // HTML cru vira texto escapado (&lt;script&gt;), nunca tag/atributo de verdade.
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/<img[^>]*onerror/);
    expect(html).not.toMatch(/href="javascript:/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("não renderiza nada com conteúdo vazio", async () => {
    expect(await renderMarkdown("   ")).toBe("");
  });
});
