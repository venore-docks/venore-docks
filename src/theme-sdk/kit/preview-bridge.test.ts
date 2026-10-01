import { describe, expect, it } from "vitest";
import { PREVIEW_BRIDGE_UPDATE, buildPreviewBridgeCss, previewBridgeAttributes } from "./preview-bridge";

describe("PreviewBridge — só valores validados chegam ao CSS/atributos (spec §7.2)", () => {
  it("cores hex/oklch e números passam; texto livre e nomes estranhos não", () => {
    const css = buildPreviewBridgeCss({
      type: PREVIEW_BRIDGE_UPDATE,
      tokens: {
        light: { primary: "#112233", "card-foreground": "oklch(0.5 0.1 200)", evil: "red;}body{display:none", "Bad Name": "#fff" },
        dark: { primary: "#445566" },
      },
      options: { radius: 1.5, glow: true, tint: "#abcdef", density: "compact", bad: "</style>" },
      optionUnits: { radius: "rem" },
    });
    expect(css).toBe(
      "html[data-theme]{--primary:#112233;--card-foreground:oklch(0.5 0.1 200);--opt-radius:1.5rem;--opt-tint:#abcdef;}\nhtml[data-theme].dark{--primary:#445566;}",
    );
    expect(css).not.toContain("display:none");
  });

  it("unidade fora da lista é descartada; NaN/Infinity não passam", () => {
    const css = buildPreviewBridgeCss({ type: PREVIEW_BRIDGE_UPDATE, options: { a: 2, b: Number.NaN, c: Infinity }, optionUnits: { a: "vw;color:red" } });
    expect(css).toBe("html[data-theme]{--opt-a:2;}");
  });

  it("atributos data-opt-* só para boolean e valores [a-z0-9-]", () => {
    expect(
      previewBridgeAttributes({ type: PREVIEW_BRIDGE_UPDATE, options: { glow: false, density: "compact", bad: 'x" onload="y', Upper: "x" } }),
    ).toEqual({ "data-opt-glow": "false", "data-opt-density": "compact" });
  });

  it("mensagem vazia não gera CSS", () => {
    expect(buildPreviewBridgeCss({ type: PREVIEW_BRIDGE_UPDATE })).toBe("");
  });
});
