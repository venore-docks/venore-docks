import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/cms", () => ({}));
const { pageLayoutMarkerAttributes } = await import("./page-layout");

// page-layout.css (W5) casa os marcadores que a página emite — os nomes/valores precisam bater com
// pageLayoutMarkerAttributes, e só propriedades lógicas (RTL) sem valor de design.
const css = readFileSync(fileURLToPath(new URL("../../app/styles/page-layout.css", import.meta.url)), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("page-layout.css", () => {
  it("tem regra pra cada valor não-padrão dos marcadores", () => {
    const wide = pageLayoutMarkerAttributes({ width: "wide", showRail: false, contextualPlacement: "none", template: null });
    expect(css).toContain(`[data-page-width="${wide["data-page-width"]}"]`);
    expect(css).toContain('[data-page-width="full"]');
    expect(css).toContain(`[data-page-rail="${wide["data-page-rail"]}"]`);
    expect(css).toContain(`[data-page-contextual="${wide["data-page-contextual"]}"]`);
    expect(css).toContain(":has(");
  });

  it("usa só propriedades lógicas e nenhum literal de design", () => {
    expect(css).not.toMatch(/\b(max-width|width|margin-left|margin-right|left|right)\s*:/);
    expect(css).not.toMatch(/[\d.]+(px|rem|em|vh|vw)\b/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
