import { createElement } from "react";
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
  // Lote id -> url: com displayWidth devolve a "miniatura", sem ele o original (como o real).
  getMediaAssetUrls: async ({ ids, displayWidth }: { ids: string[]; displayWidth?: number }) => ({
    success: true,
    data: Object.fromEntries(ids.filter((id) => id !== "missing").map((id) => [id, `https://cdn.test/${id}${displayWidth ? ".thumb" : ""}.jpg`])),
  }),
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

describe("core.layout.gallery", () => {
  const imageBlock = (id: string, mediaId: string, alt: string) => ({ id, key: "core.content.image", slot: "", htmlId: null, areas: [], data: { mediaId, alt, caption: "" } });

  async function renderGallery(data: Record<string, unknown>, mediaIds = ["a", "b"]): Promise<string> {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const renderer = await resolveBlockRenderer("core.layout.gallery");
    if (!renderer) throw new Error("sem renderer de galeria");
    const node = await renderer({
      block: {
        id: "g1",
        key: "core.layout.gallery",
        slot: "",
        htmlId: null,
        data,
        areas: [{ key: "items", blocks: mediaIds.map((mediaId, index) => imageBlock(`i${index}`, mediaId, `Foto ${mediaId}`)) }],
      } as never,
      mode: "published",
      renderBlocks: async (blocks: { id: string }[]) => blocks.map((child) => createElement("span", { key: child.id, "data-legacy-child": "" })),
    });
    return renderToStaticMarkup(node as never);
  }

  it("galeria antiga (só columns/gap) segue renderizando os filhos na grade de sempre", async () => {
    const html = await renderGallery({ columns: 3, gap: "md" });
    expect(html).toContain("data-legacy-child");
    expect(html).toContain("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3");
    expect(html).not.toContain("shadow-panel");
  });

  it("mural sem lightbox: cartões com miniatura lazy, sombra do tema, proporção e colunas mobile-first", async () => {
    const html = await renderGallery({ columns: 4, gap: "md", variant: "mural", aspect: "10-9" });
    expect(html).toContain("grid-cols-2 sm:grid-cols-3 lg:grid-cols-4");
    expect(html).toContain("shadow-panel");
    expect(html).toContain("aspect-[10/9]");
    expect(html).toContain('src="https://cdn.test/a.thumb.jpg"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).not.toContain("<button");
  });

  it("lightbox: cada cartão é um <button> com aria-label = alt", async () => {
    const html = await renderGallery({ variant: "mural", lightbox: true });
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Foto a"');
    expect(html).not.toContain("role=\"dialog\"");
  });

  it("ignora imagem cujo asset não existe e não renderiza galeria vazia", async () => {
    expect(await renderGallery({ variant: "mural" }, ["a", "missing"])).not.toContain("missing");
    expect(await renderGallery({ variant: "mural" }, ["missing"])).toBe("");
  });
});

describe("core.layout.tabs", () => {
  it("tabs-item aceita galeria na área de conteúdo e tem o campo opcional de contador", () => {
    const tabsItem = listBlockDefinitions().find((definition) => definition.key === "core.layout.tabs-item");
    expect(tabsItem?.areaDefinitions?.[0].allowedBlockKeys).toContain("core.layout.gallery");
    expect(tabsItem?.editorFields.map((field) => field.name)).toEqual(["label", "badge"]);
  });

  it("mostra o contador ao lado do rótulo e deixa a lista rolar na horizontal", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const renderer = await resolveBlockRenderer("core.layout.tabs");
    if (!renderer) throw new Error("sem renderer de abas");
    const tab = (id: string, label: string, badge?: string) => ({ id, key: "core.layout.tabs-item", slot: "", htmlId: null, areas: [], data: { label, ...(badge ? { badge } : {}) } });
    const node = await renderer({
      block: { id: "t1", key: "core.layout.tabs", slot: "", htmlId: null, data: {}, areas: [{ key: "items", blocks: [tab("t-a", "Novembro", "4"), tab("t-b", "Outubro")] }] } as never,
      mode: "published",
      renderBlocks: async () => [],
    });
    const html = renderToStaticMarkup(node as never);
    expect(html).toContain("overflow-x-auto");
    expect(html).toMatch(/Novembro<span[^>]*>4<\/span>/);
    expect(html).not.toMatch(/Outubro<span/);
  });
});
