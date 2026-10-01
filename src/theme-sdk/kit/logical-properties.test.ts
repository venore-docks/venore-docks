import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countPhysicalClasses } from "@/test-support/themes/logical-properties";
import baseline from "./logical-properties.baseline.json";

// Propriedades lógicas (spec v8 §7.11): nenhuma classe de direção física NOVA nesta pasta. O
// baseline é o que veio de antes da v8; dono: W3 (kit) — converte (ms/me, ps/pe, start/end,
// border-s/e, rounded-s/e, text-start/end) e baixa o número até zerar.
describe("propriedades lógicas — src/theme-sdk/kit", () => {
  const counts = countPhysicalClasses(fileURLToPath(new URL(".", import.meta.url)));
  const allowed = baseline as Record<string, number>;

  it("nenhum arquivo passa do baseline", () => {
    const regressions = Object.entries(counts).filter(([file, count]) => count > (allowed[file] ?? 0));
    expect(regressions).toEqual([]);
  });
});
