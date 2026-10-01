import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Regra de propriedades lógicas (spec v8 §7.11 / §11): classes de direção física (ml/mr/pl/pr,
// left/right, border-l/r, rounded-l/r, text-left/right…) quebram RTL. Em vez de uma regra de lint
// com severidade única (que hoje falharia — o kit veio do slime com classes físicas), cada pasta
// tem um teste com BASELINE: nada novo entra, e o dono só pode baixar o número.
const PHYSICAL_CLASS =
  /(?<![\w-])-?(?:[a-z]+:)*-?(?:m[lr]|p[lr]|left|right|border-[lr]|rounded-[lr]|rounded-(?:tl|tr|bl|br)|scroll-m[lr]|scroll-p[lr])-[\w./[\]-]+|(?<![\w-])(?:[a-z]+:)*(?:text-(?:left|right)|float-(?:left|right)|clear-(?:left|right)|origin-(?:left|right)|border-[lr]|rounded-[lr])(?![\w-])/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

// Conta ocorrências por arquivo (relativo a `root`) em literais de string do código.
export function countPhysicalClasses(root: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of walk(root)) {
    const source = readFileSync(file, "utf-8");
    const strings = source.match(/"[^"\n]*"|`[^`]*`/g) ?? [];
    const total = strings.reduce((sum, literal) => sum + (literal.match(PHYSICAL_CLASS)?.length ?? 0), 0);
    if (total > 0) counts[path.relative(root, file).split(path.sep).join("/")] = total;
  }
  return counts;
}
