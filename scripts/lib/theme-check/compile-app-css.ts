import { readFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

// CSS do app compilado sem `next build` (spec v8 §10, job `themes`): o mesmo pipeline que o Next
// aplica ao globals.css (`@tailwindcss/postcss`), com os @import dos temas instalados e os
// @source dos pacotes (theme-imports.generated.css). O resultado vai inline no HTML do harness SSR
// — o Playwright abre a página via setContent, sem servidor nem rede.
export async function compileAppCss(root: string = process.cwd()): Promise<string> {
  const from = path.join(root, "src/app/globals.css");
  const source = await readFile(from, "utf8");
  const result = await postcss([tailwindcss({ base: root })]).process(source, { from });
  return result.css;
}
