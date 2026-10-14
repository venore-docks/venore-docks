import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Prova executável de AGENTS.md seção 3: globals.css nunca declara valor de design (cor, raio,
// sombra, espaçamento, tipografia, peso, duração, curva de easing, proporção de escala) — só
// CONSOME variáveis definidas por um tema (src/themes/<tema>/theme.css). Qualquer literal de
// design que reapareça aqui é um bug de arquitetura, não um detalhe de estilo.

// globals.css + os arquivos de token da v8 (src/app/styles/*.css — spec §3), mesmo contrato.
const CSS_PATHS = [
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  ...readdirSync(fileURLToPath(new URL("./styles/", import.meta.url)))
    .filter((name) => name.endsWith(".css"))
    .map((name) => fileURLToPath(new URL(`./styles/${name}`, import.meta.url))),
];

function stripDesignAgnosticSections(css: string): string {
  return (
    css
      // comentários — podem citar valores de outros arquivos como referência textual
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // técnica padrão de acessibilidade (prefers-reduced-motion): os literais aqui (0.01ms, 1,
      // auto) são a constante da técnica, não um token de marca — não vêm de tema em nenhum
      // design system.
      .replace(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\r?\n\}\r?\n/, "")
      // referências a variável são sempre permitidas — o que sobra depois é que não pode
      // conter valor de design cru. var(...) aqui nunca aninha outro var(...) com vírgula de
      // fallback neste arquivo, então uma passada não-gulosa é suficiente.
      .replace(/var\([^()]*\)/g, "")
      // segunda passada: var(--a, var(--b)) — a primeira só tira o var() interno.
      .replace(/var\([^()]*\)/g, "")
  );
}

describe.each(CSS_PATHS.map((path) => [path.split("/src/app/")[1], path]))("%s não declara valor de design", (_name, cssPath) => {
  const raw = readFileSync(cssPath, "utf8");
  const scrubbed = stripDesignAgnosticSections(raw);

  it("não contém cor hex", () => {
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("não contém função de cor com valor literal (oklch/oklab/rgb/hsl/color-mix)", () => {
    expect(scrubbed).not.toMatch(/\b(oklch|oklab|rgb|rgba|hsl|hsla|color-mix)\s*\(/);
  });

  it("não contém curva de easing literal (cubic-bezier)", () => {
    expect(scrubbed).not.toMatch(/cubic-bezier\s*\(/);
  });

  it("não contém gradiente literal (linear-gradient/radial-gradient)", () => {
    expect(scrubbed).not.toMatch(/\b(linear|radial)-gradient\s*\(/);
  });

  it("não contém medida de design literal (px/rem/em/vh/vw/pt/ch)", () => {
    expect(scrubbed).not.toMatch(/[\d.]+(px|rem|em|vh|vw|vmin|vmax|pt|ch)\b/);
  });

  it("não contém duração literal (ms/s) fora da técnica de acessibilidade já removida", () => {
    expect(scrubbed).not.toMatch(/[\d.]+m?s\b/);
  });
});
