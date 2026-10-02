// CSS de herança entre temas (spec v8 §3.1, dono W9). Puro (sem disco): scripts/lib/theme-registry-
// codegen.ts chama buildThemeLineage com o CSS que scripts/gen-theme-registry.ts leu, e grava o
// resultado em src/themes/theme-lineage.generated.css (importado em globals.css ANTES de
// theme-imports.generated.css).
//
// Pra um filho C com cadeia [C, P, G], cada ancestral entra reescrito: todo `[data-theme="P"]`
// vira `:is([data-theme="P"],[data-theme="C"])` (todos os descendentes instalados de P na lista).
// `:is()` tem a especificidade do argumento mais específico — (0,1,0), igual ao atributo original
// — então a cascata entre pai e filho continua decidida só pela ordem: ancestral mais distante
// primeiro, filho (theme.css próprio, só diffs) por último. `<html data-theme>` tem UMA chave (a do
// filho): `--chart-1: var(--primary)` do pai é computado com o `--primary` do filho no mesmo elemento.
import postcss, { type AtRule, type ChildNode, type Root } from "postcss";
import selectorParser, { type Node as SelectorNode, type Selector } from "postcss-selector-parser";
import { declaredTokenNames, extractRuleBody } from "../src/themes/theme-token-contract";

export type LineageTheme = { key: string; lineage: readonly string[]; css?: string };
export type LineageIssue = { level: "error" | "warning"; themeKey: string; code: string; message: string };
export type ThemeLineageOutput = {
  css: string; // corpo do theme-lineage.generated.css (sem cabeçalho)
  byTheme: Record<string, string>; // CSS de lineage que cada tema efetivo puxa (orçamento, W10)
  issues: LineageIssue[];
};

const THEME_ATTRIBUTE = "data-theme";
// At-rules que só agrupam regras: o conteúdo é reescrito. Todo o resto (@import, @source, @theme,
// @custom-variant, @font-face, @keyframes, @property…) é global e já chega pelo import do próprio
// ancestral — duplicar só aumentaria o CSS.
const GROUPING_AT_RULES = new Set(["media", "supports", "layer", "container"]);

const themeAttribute = (key: string) => `[${THEME_ATTRIBUTE}="${key}"]`;

// Seletor exato emitido pra um ancestral — determinístico (ancestral primeiro, descendentes em
// ordem alfabética), pra extractRuleBody achar o bloco no texto gerado.
export function lineageSelector(ancestorKey: string, descendantKeys: readonly string[]): string {
  const descendants = [...new Set(descendantKeys)].filter((key) => key !== ancestorKey).sort();
  return `:is(${[ancestorKey, ...descendants].map(themeAttribute).join(",")})`;
}

function isThemeAttribute(node: SelectorNode, key: string): boolean {
  return (
    node.type === "attribute" &&
    node.attribute === THEME_ATTRIBUTE &&
    (node.operator === "=" || node.operator === undefined) &&
    node.value === key
  );
}

function containsThemeAttribute(selector: Selector, key: string): boolean {
  let found = false;
  selector.walkAttributes((node) => {
    if (isThemeAttribute(node, key)) found = true;
  });
  return found;
}

// Reescreve UM seletor; null = o seletor não fala do ancestral (é descartado da cópia).
export function rewriteSelector(selector: string, ancestorKey: string, descendantKeys: readonly string[]): string | null {
  const replacement = lineageSelector(ancestorKey, descendantKeys);
  const kept: string[] = [];
  selectorParser((selectors) => {
    selectors.each((item) => {
      if (!containsThemeAttribute(item, ancestorKey)) return;
      item.walkAttributes((node) => {
        if (isThemeAttribute(node, ancestorKey)) node.replaceWith(selectorParser.pseudo({ value: replacement }));
      });
      kept.push(item.toString().trim());
    });
  }).processSync(selector);
  return kept.length > 0 ? kept.join(",\n") : null;
}

function rewriteNodes(container: Root | AtRule, ancestorKey: string, descendantKeys: readonly string[]): void {
  container.each((node: ChildNode) => {
    if (node.type === "comment") {
      node.remove();
    } else if (node.type === "rule") {
      const selector = rewriteSelector(node.selector, ancestorKey, descendantKeys);
      if (selector === null) node.remove();
      else node.selector = selector;
    } else if (node.type === "atrule") {
      if (!GROUPING_AT_RULES.has(node.name.toLowerCase()) || !node.nodes) {
        node.remove();
        return;
      }
      rewriteNodes(node, ancestorKey, descendantKeys);
      if (!node.nodes || node.nodes.length === 0) node.remove();
    } else {
      node.remove(); // declaração solta no topo: não é CSS válido de tema
    }
  });
}

// O theme.css do ancestral, só com as regras escopadas nele, reescritas pro grupo da lineage.
export function rewriteAncestorCss(css: string, ancestorKey: string, descendantKeys: readonly string[]): string {
  const root = postcss.parse(css);
  rewriteNodes(root, ancestorKey, descendantKeys);
  root.raws.after = "\n";
  const out = root.toString().trim();
  return out ? out + "\n" : "";
}

// Especificidade (a, b, c) — `:is()`/`:not()`/`:has()` valem o argumento mais específico, `:where()`
// vale zero (Selectors 4). Usado pra provar que a reescrita não muda a cascata.
export type Specificity = readonly [number, number, number];

function addSpecificity(a: Specificity, b: Specificity): Specificity {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function nodeSpecificity(node: SelectorNode): Specificity {
  switch (node.type) {
    case "id":
      return [1, 0, 0];
    case "class":
    case "attribute":
      return [0, 1, 0];
    case "tag":
      return [0, 0, 1];
    case "pseudo": {
      const name = node.value.toLowerCase();
      if (name.startsWith("::") || [":before", ":after", ":first-line", ":first-letter"].includes(name)) return [0, 0, 1];
      if (name === ":where") return [0, 0, 0];
      if ([":is", ":not", ":has", ":matches"].includes(name)) {
        return node.nodes
          .map((inner) => compoundSpecificity(inner as Selector))
          .reduce<Specificity>((max, value) => (compareSpecificity(value, max) > 0 ? value : max), [0, 0, 0]);
      }
      return [0, 1, 0];
    }
    default:
      return [0, 0, 0];
  }
}

function compoundSpecificity(selector: Selector): Specificity {
  return selector.nodes.reduce<Specificity>((sum, node) => addSpecificity(sum, nodeSpecificity(node)), [0, 0, 0]);
}

export function selectorSpecificity(selector: string): Specificity {
  let result: Specificity = [0, 0, 0];
  selectorParser((selectors) => {
    result = compoundSpecificity(selectors.first);
  }).processSync(selector);
  return result;
}

// Descendentes instalados de cada ancestral (temas cuja lineage o contém depois da posição 0).
function descendantsByAncestor(themes: readonly LineageTheme[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const theme of themes) {
    for (const ancestor of theme.lineage.slice(1)) {
      map.set(ancestor, [...(map.get(ancestor) ?? []), theme.lineage[0]]);
    }
  }
  return map;
}

// Profundidade do ancestral na própria lineage (raiz = 0): ordem topológica, raiz primeiro.
function ancestorDepth(key: string, themes: readonly LineageTheme[]): number {
  for (const theme of themes) {
    const index = theme.lineage.indexOf(key);
    if (index >= 0) return theme.lineage.length - 1 - index;
  }
  return 0;
}

// Lint (spec §3.1): o filho redeclara T no bloco base, um ancestral flipa T no `.dark` e o filho
// não — o `.dark` do ancestral, (0,2,0), vence o base do filho, (0,1,0), e o modo escuro fica com
// a cor do pai.
export function lintIncompleteDarkOverrides(
  lineage: readonly string[],
  cssOf: (key: string) => string | undefined,
): LineageIssue[] {
  const [self, ...ancestors] = lineage;
  const ownCss = cssOf(self);
  if (!ownCss || ancestors.length === 0) return [];
  const base = new Set(declaredTokenNames(extractRuleBody(ownCss, themeAttribute(self)) ?? ""));
  const dark = new Set(declaredTokenNames(extractRuleBody(ownCss, `${themeAttribute(self)}.dark`) ?? ""));
  const issues: LineageIssue[] = [];
  for (const ancestor of ancestors) {
    const ancestorCss = cssOf(ancestor);
    if (!ancestorCss) continue;
    const flipped = declaredTokenNames(extractRuleBody(ancestorCss, `${themeAttribute(ancestor)}.dark`) ?? "");
    const incomplete = [...new Set(flipped)].filter((token) => base.has(token) && !dark.has(token));
    if (incomplete.length === 0) continue;
    issues.push({
      level: "warning",
      themeKey: self,
      code: "incomplete-dark-override",
      message:
        `"${self}" redeclara ${incomplete.join(", ")} no bloco base mas não no .dark, e "${ancestor}" ` +
        `flipa esses tokens no .dark — no modo escuro vale o valor de "${ancestor}". Redeclare-os em ` +
        `${themeAttribute(self)}.dark.`,
    });
    for (const token of incomplete) dark.add(token); // um aviso por token, no ancestral mais próximo
  }
  return issues;
}

export function buildThemeLineage(themes: readonly LineageTheme[], extraCss: Readonly<Record<string, string>> = {}): ThemeLineageOutput {
  const cssByKey = new Map<string, string>(Object.entries(extraCss));
  for (const theme of themes) if (theme.css !== undefined) cssByKey.set(theme.key, theme.css);
  const cssOf = (key: string) => cssByKey.get(key);

  const issues: LineageIssue[] = [];
  const inheriting = themes.filter((theme) => theme.lineage.length > 1);
  const descendants = descendantsByAncestor(inheriting);
  const ancestors = [...descendants.keys()].sort(
    (a, b) => ancestorDepth(a, inheriting) - ancestorDepth(b, inheriting) || a.localeCompare(b),
  );

  const blocks = new Map<string, string>();
  for (const ancestor of ancestors) {
    const css = cssOf(ancestor);
    if (css === undefined) {
      for (const child of descendants.get(ancestor) ?? []) {
        issues.push({
          level: "warning",
          themeKey: child,
          code: "lineage-missing-css",
          message: `theme.css do ancestral "${ancestor}" não foi encontrado — "${child}" herda só os componentes, não os tokens dele.`,
        });
      }
      continue;
    }
    const rewritten = rewriteAncestorCss(css, ancestor, descendants.get(ancestor) ?? []);
    if (rewritten) blocks.set(ancestor, rewritten);
  }

  for (const theme of inheriting) issues.push(...lintIncompleteDarkOverrides(theme.lineage, cssOf));

  const css = ancestors
    .filter((ancestor) => blocks.has(ancestor))
    .map((ancestor) => `/* lineage: ${ancestor} ← ${[...new Set(descendants.get(ancestor))].sort().join(", ")} */\n${blocks.get(ancestor)}`)
    .join("\n");

  // Por tema: só os ancestrais da própria cadeia (mesma ordem topológica do arquivo).
  const byTheme = Object.fromEntries(
    inheriting.map((theme) => [
      theme.key,
      [...theme.lineage.slice(1)]
        .reverse()
        .map((ancestor) => blocks.get(ancestor) ?? "")
        .join(""),
    ]),
  );
  return { css, byTheme, issues };
}

// Tokens declarados pelo tema EFETIVO de uma cadeia [self, pai, avô], lidos do texto da lineage
// gerada (extractRuleBody com o seletor `:is()`) + o theme.css do próprio tema. Entrada do contrato
// de tokens ciente de herança (theme-token-contract.test.ts).
export function chainDeclaredTokens(
  lineage: readonly string[],
  cssOf: (key: string) => string | undefined,
): { base: string[]; dark: string[] } {
  const [self, ...ancestors] = lineage;
  // Todo membro entra com a própria sub-cadeia — é o que o codegen vê com a cadeia instalada.
  const themes = lineage.map((key, index) => ({ key, lineage: lineage.slice(index), css: cssOf(key) }));
  const generated = buildThemeLineage(themes).css;
  const base = new Set<string>();
  const dark = new Set<string>();
  ancestors.forEach((ancestor, index) => {
    const selector = lineageSelector(ancestor, lineage.slice(0, index + 1));
    for (const name of declaredTokenNames(extractRuleBody(generated, selector) ?? "")) base.add(name);
    for (const name of declaredTokenNames(extractRuleBody(generated, `${selector}.dark`) ?? "")) dark.add(name);
  });
  const ownCss = cssOf(self) ?? "";
  for (const name of declaredTokenNames(extractRuleBody(ownCss, themeAttribute(self)) ?? "")) base.add(name);
  for (const name of declaredTokenNames(extractRuleBody(ownCss, `${themeAttribute(self)}.dark`) ?? "")) dark.add(name);
  return { base: [...base], dark: [...dark] };
}
