import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Shell } from "./components/Shell";
import { SLIME_PARITY_SCENARIOS, normalizeParityHtml } from "./parity.fixtures";

// Snapshot de paridade do venore-slime (spec v8 §12, Fase F passo 0). Gravado ANTES de mover os
// componentes pro kit; depois da mudança o mesmo arquivo de snapshot de cada cenário precisa bater
// byte a byte (após o normalizador, que só tira data-region/data-outlet/data-block*).
vi.mock("next/navigation", () => ({ usePathname: () => "/blog" }));

const content = <p>Conteúdo da página</p>;

describe("venore-slime — paridade do Shell", () => {
  for (const scenario of SLIME_PARITY_SCENARIOS) {
    it(`Shell: ${scenario.name}`, async () => {
      const html = normalizeParityHtml(renderToStaticMarkup(<Shell {...scenario.props}>{content}</Shell>));
      await expect(html).toMatchFileSnapshot(`./__parity__/${scenario.name}.html`);
    });
  }
});
