import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultThemeConfigDocument, type ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import type { ResolvedThemeDefinitionView } from "./types";

vi.mock("../../actions", () => ({
  generateSeedPaletteAction: vi.fn(),
  checkPaletteContrastAction: vi.fn(),
}));

const { PalettePanel } = await import("./palette-panel");
const { PaletteContrastSummary } = await import("../../_components/palette-contrast-summary");

const theme = { key: "venore-slime", colorPalettes: [], palette: undefined } as unknown as ResolvedThemeDefinitionView;
const withChoice = (palette: ThemeConfigDocument["byTheme"][string]["palette"]): ThemeConfigDocument => ({
  ...defaultThemeConfigDocument("venore-slime"),
  byTheme: { "venore-slime": { palette, options: {}, fonts: {} } },
});

describe("PalettePanel (SSR)", () => {
  it("marca o modo da escolha do rascunho e oferece os quatro modos", () => {
    const html = renderToStaticMarkup(<PalettePanel draft={withChoice({ mode: "default" })} theme={theme} onChange={() => {}} />);
    expect(html).toContain("Padrão do tema");
    expect(html).toContain("Cor de marca");
    expect(html).toContain("Personalizada");
    expect(html).toContain(`<input type="radio" name="palette-mode" checked="" value="default"/>`);
  });

  it("modo semente: picker com a semente salva", () => {
    const html = renderToStaticMarkup(
      <PalettePanel
        draft={withChoice({ mode: "seed", seed: "#112233", generated: { light: {}, dark: {} } })}
        theme={theme}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('value="#112233"');
    expect(html).toContain("Gerar paleta");
  });

  it("modo personalizada: um picker por token e modo, convertendo oklch pra hex", () => {
    const html = renderToStaticMarkup(
      <PalettePanel draft={withChoice({ mode: "custom", light: { background: "oklch(1 0 0)" }, dark: {} })} theme={theme} onChange={() => {}} />,
    );
    expect(html).toContain('id="palette-light-background"');
    expect(html).toContain('id="palette-dark-primary"');
    expect(html).toMatch(/id="palette-light-background"[^>]*value="#ffffff"|value="#ffffff"[^>]*id="palette-light-background"/);
  });
});

describe("PaletteContrastSummary", () => {
  it("ok sem problemas; lista as mensagens quando há", () => {
    expect(renderToStaticMarkup(<PaletteContrastSummary problems={[]} />)).toContain("Contraste ok");
    const html = renderToStaticMarkup(
      <PaletteContrastSummary problems={[{ region: "rail", mode: "dark", message: "Contraste ruim no rail" }]} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Contraste ruim no rail");
  });
});
