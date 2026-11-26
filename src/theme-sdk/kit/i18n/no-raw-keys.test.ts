import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KIT_MESSAGES_PT_BR } from "./messages/pt-BR";

// Falha se o código chama t(strings, "chave.literal") com uma chave que não existe no catálogo
// pt-BR — o `t` devolveria a própria chave e ela apareceria crua na tela.
const ROOTS = ["../", "../../../components/", "../../../platform/"].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("chaves i18n do kit", () => {
  it("toda chave literal passada a t() existe no catálogo pt-BR", () => {
    const known = new Set(Object.keys(KIT_MESSAGES_PT_BR));
    const missing: string[] = [];
    for (const file of ROOTS.flatMap((root) => walk(root))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*[A-Za-z_.?]+,\s*"([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)"/g)) {
        if (!known.has(match[1])) missing.push(`${file}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
