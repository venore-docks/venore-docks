import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countPhysicalClasses } from "@/test-support/themes/logical-properties";
import baseline from "./logical-properties.baseline.json";

// Propriedades lógicas (spec v8 §7.11): nenhuma classe de direção física nesta pasta. O W3
// converteu tudo o que é dele (ms/me, ps/pe, start/end, border-s/e, text-start, origin espelhado
// via rtl:) e a barra contextual seguiu — o baseline está vazio e só pode continuar assim.
describe("propriedades lógicas — src/theme-sdk/kit", () => {
  const counts = countPhysicalClasses(fileURLToPath(new URL(".", import.meta.url)));
  const allowed = baseline as Record<string, number>;

  it("nenhum arquivo passa do baseline", () => {
    const regressions = Object.entries(counts).filter(([file, count]) => count > (allowed[file] ?? 0));
    expect(regressions).toEqual([]);
  });
});
