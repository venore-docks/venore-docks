import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import postcss from "postcss";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildThemeRegistry, type ThemePackageInput } from "../../scripts/lib/theme-registry-codegen";
import {
  buildThemeLineage,
  chainDeclaredTokens,
  lineageSelector,
  lintIncompleteDarkOverrides,
  rewriteAncestorCss,
  rewriteSelector,
  selectorSpecificity,
} from "../../scripts/theme-lineage";
import type { ResolvedThemeDefinition, ThemeDefinition } from "@/contexts/themes/contracts/v8";
import { withThemeSelected } from "@/app/(platform)/admin/themes/customize/_panels/theme-panel";
import { defaultThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import { checkInheritanceChain, resolveInheritance } from "@/platform/theme-rendering/apply-inheritance";
import { normalizeRegistryEntry } from "@/platform/theme-rendering/normalize-entry";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { resolveThemeOptions } from "@/platform/theme-rendering/resolve-theme-options";
import {
  ChildCategory,
  ChildEntryMagazine,
  ChildForbiddenState,
  ChildHeroSplit,
  ChildQuote,
  fixtureChildTheme,
} from "@/test-support/themes/fixture-child/theme";
import {
  ParentEmptyState,
  ParentEntry,
  ParentEntryWide,
  ParentFooter,
  ParentHero,
  ParentHome,
  fixtureParentTheme,
} from "@/test-support/themes/fixture-parent/theme";
import { KIT_STATES } from "@/theme-sdk/kit/states";
import { KIT_TEMPLATES } from "@/theme-sdk/kit/templates";
import { THEME_REGISTRY, type ThemeRegistryEntry } from "./registry";
import { declaredTokenNames, extractRuleBody, isColorValue, isOptionalV8Token, SLIME_IDENTITY_TOKENS, tokenValue } from "./theme-token-contract";

// Herança entre temas (spec v8 §7.1 / §3.1, W9). Fixtures em src/test-support/themes/:
// fixture-child → fixture-parent → venore-slime (profundidade máxima, 3).

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const readCss = (path: string) => readFileSync(join(ROOT, path), "utf8");
const SLIME_CSS = readCss("src/themes/venore-slime/theme.css");
const PARENT_CSS = readCss("src/test-support/themes/fixture-parent/theme.css");
const CHILD_CSS = readCss("src/test-support/themes/fixture-child/theme.css");
const CSS_BY_KEY: Record<string, string> = { "venore-slime": SLIME_CSS, "fixture-parent": PARENT_CSS, "fixture-child": CHILD_CSS };
const cssOf = (key: string) => CSS_BY_KEY[key];

function v8Entry(definition: ThemeDefinition, lineage: readonly string[]): ThemeRegistryEntry {
  return {
    contract: 8,
    manifest: definition.manifest,
    definition,
    colorPalettes: definition.colorPalettes ?? [],
    packageVersion: definition.manifest.version,
    packageName: `@venore/theme-${definition.manifest.key}`,
    lineage,
  };
}

const REGISTRY: Record<string, ThemeRegistryEntry> = {
  "venore-slime": THEME_REGISTRY["venore-slime"],
  "fixture-parent": v8Entry(fixtureParentTheme, ["fixture-parent", "venore-slime"]),
  "fixture-child": v8Entry(fixtureChildTheme, ["fixture-child", "fixture-parent", "venore-slime"]),
};

function resolve(key: string, registry: Record<string, ThemeRegistryEntry> = REGISTRY): ResolvedThemeDefinition {
  const result = resolveThemeDefinition(key, { registry });
  expect(result.fallback).toBeNull();
  return result.theme;
}

const child = resolve("fixture-child");
const parent = resolve("fixture-parent");

describe("herança — tabela de merge (spec §7.1)", () => {
  it("cadeia e identidade: chave, nome e versão são do filho", () => {
    expect(child.key).toBe("fixture-child");
    expect(child.chain).toEqual(["fixture-child", "fixture-parent", "venore-slime"]);
    expect(child.manifest.name).toBe("Fixture Child");
    expect(child.manifest.extends).toBe("fixture-parent");
    expect(child.contract).toBe(8);
    expect(child.legacyShell).toBeNull();
  });

  it("regiões: filho vence por chave e recebe o override do pai como Default; região só do pai é herdada", () => {
    expect([...child.replacedRegions].sort()).toEqual(["footer", "header"]);
    expect(child.regions.footer).toBe(ParentFooter);

    const Kit = ({ label }: { label?: string }) => createElement("span", { "data-fixture": "kit" }, label ?? "kit");
    const Header = child.regions.header as unknown as ComponentType<{ label: string; Default: ComponentType<{ label: string }> }>;
    const html = renderToStaticMarkup(createElement(Header, { label: "marca", Default: Kit }));
    expect(html).toBe(
      '<div data-fixture="child-header"><div data-fixture="parent-header"><span data-fixture="kit">marca</span></div></div>',
    );
    // O Default ligado ao pai é estável entre renders (mesmo Kit ⇒ mesmo componente).
    const seen: unknown[] = [];
    const Spy = ({ Default }: { Default: unknown }) => {
      seen.push(Default);
      return null;
    };
    const Inherited = resolveInheritance(
      { ...child, chain: ["x", "y"], key: "x", replacedRegions: ["header"], regions: { ...child.regions, header: Spy as never } },
      [{ ...parent, key: "y", chain: ["y"] }],
    ).theme.regions.header as unknown as ComponentType<{ Default: ComponentType }>;
    renderToStaticMarkup(createElement(Inherited, { Default: Kit as ComponentType }));
    renderToStaticMarkup(createElement(Inherited, { Default: Kit as ComponentType }));
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });

  it("templates: filho vence por chave e por variante; variantes do pai continuam disponíveis", () => {
    expect(child.templates.entry).toEqual({ default: ParentEntry, wide: ParentEntryWide, magazine: ChildEntryMagazine });
    expect(child.templates.home.default).toBe(ParentHome);
    expect(child.templates.category.default).toBe(ChildCategory);
    expect(child.templates.account.default).toBe(KIT_TEMPLATES.account);
  });

  it("estados: filho vence por chave, o resto vem do pai e depois do kit", () => {
    expect(child.states.empty).toBe(ParentEmptyState);
    expect(child.states.forbidden).toBe(ChildForbiddenState);
    expect(child.states.loading).toBe(KIT_STATES.loading);
  });

  it("blockRenderers: o mapa do filho vence por bloco e variante, loaders compostos (lazy)", async () => {
    const renderers = await child.blockRenderers();
    expect(renderers.hero).toEqual({ default: ParentHero, split: ChildHeroSplit });
    expect(renderers.quote).toEqual({ default: ChildQuote });
    // Nada é carregado antes da chamada: o loader composto continua lazy.
    let calls = 0;
    const lazyParent = { ...parent, blockRenderers: async () => (calls++, {}) };
    const composed = resolveInheritance({ ...child, chain: ["fixture-child", "fixture-parent"] }, [{ ...lazyParent, chain: ["fixture-parent"] }]).theme;
    expect(calls).toBe(0);
    await composed.blockRenderers();
    expect(calls).toBe(1);
  });

  it("opções: merge por chave; filho muda default/label/choices, nunca o tipo; removeOptions esconde", () => {
    const byKey = Object.fromEntries(child.options.map((field) => [field.key, field]));
    expect(child.options.map((field) => field.key)).toEqual(["density", "hero-height", "tagline"]);
    expect(byKey.density).toMatchObject({
      type: "select",
      label: "Densidade do filho",
      default: "compact",
      choices: [
        { value: "compact", label: "Compacta" },
        { value: "dense", label: "Densa" },
      ],
    });
    expect(byKey["hero-height"]).toMatchObject({ type: "range", default: 24, min: 16 });
    // O pai continua com a própria opção.
    expect(parent.options.map((field) => field.key)).toContain("show-tagline");
  });

  it("opções: o manifesto mesclado mantém removeOptions (W2 marca o valor salvo como `removed`)", () => {
    expect(child.manifest.removeOptions).toEqual(["show-tagline"]);
    const resolved = resolveThemeOptions(child, { "show-tagline": false, density: "dense" }, undefined);
    expect(resolved.ignored).toContainEqual({ key: "show-tagline", reason: "removed" });
    expect(resolved.values.density).toBe("dense");
    expect(resolved.values["hero-height"]).toBe(24);
  });

  it("messages: deep merge por locale", () => {
    expect(child.messages).toEqual({
      "pt-BR": { "fixture.greeting": "Olá do filho", "fixture.parent-only": "só no pai" },
      en: { "fixture.greeting": "Hello from parent" },
      es: { "fixture.greeting": "Hola" },
    });
  });

  it("pageBuilder e templateVariants: união por value, label do filho vence", () => {
    expect(child.pageBuilder.sectionStyles).toEqual([
      { value: "spotlight", label: "Holofote" },
      { value: "quiet", label: "Discreta" },
    ]);
    expect(child.pageBuilder.blockVariants).toEqual({
      hero: [{ value: "split", label: "Em duas colunas" }],
      quote: [{ value: "pull", label: "Citação" }],
    });
    expect([...child.pageBuilder.hideSectionStyles].sort()).toEqual(["accent", "inverted"]);
    expect(child.templateVariants.entry).toEqual([
      { value: "wide", label: "Bem larga" },
      { value: "magazine", label: "Revista" },
    ]);
  });

  it("palette, fonts, responsive, seo, budgets: raso, filho vence", () => {
    expect(child.palette).toEqual({ accent: "complement", allowCustom: true, lockedTokens: ["--destructive"] });
    expect(child.fonts).toEqual({ sans: "inter", display: "fraunces", mono: "geist-mono" });
    expect(child.fontChoices).toEqual({ sans: ["inter", "manrope"], display: ["fraunces", "playfair-display"] });
    expect(child.responsive).toEqual({ mobileNav: "drawer", mobileNavChoices: [], contextualBarMobile: "hidden" });
    expect(child.seo).toEqual({ themeColor: "from-tokens", structuredData: { entry: "BlogPosting" } });
    expect(child.budgets).toMatchObject({ cssGzipBytes: 4_096, clientModules: 6 });
    expect(child.manifest.locales).toEqual(["pt-BR", "en"]);
    expect([...child.outletsRendered].sort()).toEqual(["header.end", "header.start"]);
  });

  it("layout: raso, filho vence — e o manifesto mesclado carrega manifest.layout (W3 lê os campos declarados)", () => {
    expect(child.layout).toBe("rail");
    expect(child.layoutDecl).toEqual({
      preset: "rail",
      presetChoices: [],
      railSide: "end",
      collapseControl: "header",
      headerNavVisibleFrom: "lg",
    });
    expect(child.manifest.layout).toEqual({ preset: "rail", collapseControl: "header", headerNavVisibleFrom: "lg", railSide: "end" });
  });

  it("colorPalettes: filho + pai, sem repetir id (vale a do filho)", () => {
    expect(child.colorPalettes.map((palette) => `${palette.id}:${palette.name}`)).toEqual([
      "shared:Compartilhada (filho)",
      "violet:Violeta",
      "ember:Brasa",
      ...THEME_REGISTRY["venore-slime"].colorPalettes.map((palette) => `${palette.id}:${palette.name}`).filter((id) => !/^(shared|violet|ember):/.test(id)),
    ]);
  });

  it("valores guardados: byTheme[filho] nasce de byTheme[pai] na primeira escolha do filho no rascunho", () => {
    const draft = defaultThemeConfigDocument("fixture-parent");
    draft.byTheme["fixture-parent"] = { palette: { mode: "preset", presetId: "ember" }, options: { density: "compact" }, fonts: {} };
    const patch = withThemeSelected(draft, "fixture-child", child.chain);
    expect(patch.byTheme?.["fixture-child"]).toEqual(draft.byTheme["fixture-parent"]);
    expect(patch.byTheme?.["fixture-child"]).not.toBe(draft.byTheme["fixture-parent"]);
  });

  it("tema sem extends não muda (identidade)", () => {
    const slime = resolve("venore-slime");
    const normalized = normalizeRegistryEntry(THEME_REGISTRY["venore-slime"]);
    expect(slime.manifest).toBe(normalized.manifest);
    expect(slime.chain).toEqual(["venore-slime"]);
  });
});

describe("herança — cadeia inválida cai no slime com segurança", () => {
  const def = (key: string, extendsKey?: string, extra: Partial<ThemeDefinition> = {}): ThemeDefinition => ({
    manifest: { ...fixtureChildTheme.manifest, key, name: key, extends: extendsKey },
    ...extra,
  });

  it("profundidade > 3", () => {
    const registry: Record<string, ThemeRegistryEntry> = {
      ...REGISTRY,
      "fixture-grandchild": v8Entry(def("fixture-grandchild", "fixture-child"), ["fixture-grandchild", "fixture-child", "fixture-parent", "venore-slime"]),
    };
    const result = resolveThemeDefinition("fixture-grandchild", { registry });
    expect(result.theme.key).toBe("venore-slime");
    const normalized = normalizeRegistryEntry(registry["fixture-grandchild"]);
    const ancestors = normalized.chain.slice(1).map((key) => normalizeRegistryEntry(registry[key]));
    expect(checkInheritanceChain(normalized, ancestors)).toMatchObject({ code: "depth" });
  });

  it("ciclo", () => {
    const registry: Record<string, ThemeRegistryEntry> = {
      ...REGISTRY,
      "cycle-a": v8Entry(def("cycle-a", "cycle-b"), ["cycle-a", "cycle-b", "cycle-a"]),
      "cycle-b": v8Entry(def("cycle-b", "cycle-a"), ["cycle-b", "cycle-a", "cycle-b"]),
    };
    const result = resolveThemeDefinition("cycle-a", { registry });
    expect(result.theme.key).toBe("venore-slime");
    const normalized = normalizeRegistryEntry(registry["cycle-a"]);
    const out = resolveInheritance(normalized, [normalizeRegistryEntry(registry["cycle-b"]), normalizeRegistryEntry(registry["cycle-a"])]);
    expect(out.error).toMatchObject({ code: "cycle" });
    expect(out.theme.key).toBe("venore-slime");
  });

  it("ancestrais que não batem com a lineage", () => {
    const normalized = normalizeRegistryEntry(REGISTRY["fixture-child"]);
    const wrong = resolveInheritance(normalized, [normalizeRegistryEntry(REGISTRY["venore-slime"])]);
    expect(wrong.error).toMatchObject({ code: "mismatch" });
    expect(wrong.theme.key).toBe("venore-slime");
  });

  it("pai ausente ou fora da faixa: diagnóstico invalid-chain (resolveThemeDefinition)", () => {
    const registry = { ...REGISTRY };
    delete registry["fixture-parent"];
    expect(resolveThemeDefinition("fixture-child", { registry })).toMatchObject({
      theme: { key: "venore-slime" },
      fallback: { reason: "invalid-chain", requestedKey: "fixture-child" },
    });
  });

  describe("pai 7.x", () => {
    const LegacyShell = () => null;
    const legacy: ThemeRegistryEntry = {
      contract: 7,
      manifest: { ...fixtureParentTheme.manifest, key: "legacy-parent", themeContractVersion: "7.0.0", extends: undefined },
      Shell: LegacyShell,
      colorPalettes: [{ id: "legacy", name: "Legada", light: {}, dark: {} }],
      packageVersion: "7.0.0",
      packageName: "@venore/theme-legacy-parent",
    };

    it("aceito quando o filho só tem tokens/paletas/mensagens: herda o Shell inteiro", () => {
      const registry: Record<string, ThemeRegistryEntry> = {
        ...REGISTRY,
        "legacy-parent": legacy,
        "tokens-child": v8Entry(
          def("tokens-child", "legacy-parent", {
            messages: { "pt-BR": { a: "b" } },
            colorPalettes: [{ id: "mine", name: "Minha", light: {}, dark: {} }],
          }),
          ["tokens-child", "legacy-parent"],
        ),
      };
      // O manifesto de def() herda `layout` da fixture-child: tira pra ser só tokens.
      (registry["tokens-child"].manifest as { layout?: unknown }).layout = undefined;
      const theme = resolve("tokens-child", registry);
      expect(theme.legacyShell).toBe(LegacyShell);
      expect(theme.contract).toBe(7);
      expect(theme.options).toEqual([]);
      expect(theme.colorPalettes.map((palette) => palette.id)).toEqual(["mine", "legacy"]);
      expect(theme.messages).toEqual({ "pt-BR": { a: "b" } });
    });

    it("recusado quando o filho declara regiões, templates ou layout", () => {
      for (const extra of [
        { regions: fixtureChildTheme.regions },
        { templates: fixtureChildTheme.templates },
        { layout: "rail" as const },
      ]) {
        const registry: Record<string, ThemeRegistryEntry> = {
          ...REGISTRY,
          "legacy-parent": legacy,
          "structural-child": v8Entry({ ...def("structural-child", "legacy-parent", extra) }, ["structural-child", "legacy-parent"]),
        };
        (registry["structural-child"].manifest as { layout?: unknown }).layout = undefined;
        const normalized = normalizeRegistryEntry(registry["structural-child"]);
        const out = resolveInheritance(normalized, [normalizeRegistryEntry(legacy)]);
        expect(out.error).toMatchObject({ code: "legacy-parent", legacyKey: "legacy-parent", offender: "structural-child" });
        expect(resolveThemeDefinition("structural-child", { registry }).theme.key).toBe("venore-slime");
      }
    });
  });
});

// --- CSS ---------------------------------------------------------------------------------------

describe("lineage CSS (spec §3.1)", () => {
  const lineage = buildThemeLineage(
    [
      { key: "fixture-parent", lineage: ["fixture-parent", "venore-slime"], css: PARENT_CSS },
      { key: "fixture-child", lineage: ["fixture-child", "fixture-parent", "venore-slime"], css: CHILD_CSS },
    ],
    { "venore-slime": SLIME_CSS },
  );

  it("reescreve [data-theme=P] pra :is() com P e todos os descendentes, em ordem determinística", () => {
    expect(lineageSelector("fixture-parent", ["fixture-child"])).toBe(':is([data-theme="fixture-parent"],[data-theme="fixture-child"])');
    expect(rewriteSelector('[data-theme="fixture-parent"].dark', "fixture-parent", ["fixture-child"])).toBe(
      ':is([data-theme="fixture-parent"],[data-theme="fixture-child"]).dark',
    );
    expect(rewriteSelector('html[data-theme="p"]:not(.dark) .x, .other', "p", ["c"])).toBe('html:is([data-theme="p"],[data-theme="c"]):not(.dark) .x');
    expect(rewriteSelector(".unrelated", "p", ["c"])).toBeNull();
    expect(rewriteSelector('[data-theme="other"]', "p", ["c"])).toBeNull();
  });

  it("ancestrais em ordem topológica (raiz primeiro), um bloco por ancestral com todos os descendentes", () => {
    const slimeAt = lineage.css.indexOf("/* lineage: venore-slime ← fixture-child, fixture-parent */");
    const parentAt = lineage.css.indexOf("/* lineage: fixture-parent ← fixture-child */");
    expect(slimeAt).toBeGreaterThanOrEqual(0);
    expect(parentAt).toBeGreaterThan(slimeAt);
    expect(lineage.css).toContain(
      ':is([data-theme="venore-slime"],[data-theme="fixture-child"],[data-theme="fixture-parent"]) {',
    );
    expect(lineage.css).toContain(':is([data-theme="fixture-parent"],[data-theme="fixture-child"]).dark {');
    // O filho não entra como ancestral de ninguém; o CSS dele vem do próprio import.
    expect(lineage.css).not.toContain('[data-theme="fixture-child"] {');
    expect(lineage.byTheme["fixture-child"].indexOf("venore-slime")).toBeLessThan(lineage.byTheme["fixture-child"].indexOf('"fixture-parent"],'));
  });

  it("descarta o que não é escopado no ancestral (globais já vêm do import dele) e mantém @media", () => {
    const parentOnly = rewriteAncestorCss(PARENT_CSS, "fixture-parent", ["fixture-child"]);
    expect(parentOnly).not.toMatch(/@import|@font-face|fixture-unscoped|comentário/);
    expect(parentOnly).toContain("@media (min-width: 64rem)");
    expect(parentOnly).toContain(':is([data-theme="fixture-parent"],[data-theme="fixture-child"]):not(.dark) [data-region="rail"]');
  });

  it("a reescrita preserva a especificidade de todo seletor — base (0,1,0), .dark (0,2,0)", () => {
    expect(selectorSpecificity(lineageSelector("fixture-parent", ["fixture-child", "z"]))).toEqual([0, 1, 0]);
    expect(selectorSpecificity(`${lineageSelector("p", ["c"])}.dark`)).toEqual([0, 2, 0]);
    for (const [key, css] of [
      ["venore-slime", SLIME_CSS],
      ["fixture-parent", PARENT_CSS],
      ...Object.keys(THEME_REGISTRY)
        .filter((key) => key !== "venore-slime")
        .map((key) => [key, readFileSync(require.resolve(`@venore/theme-${key}/theme.css`), "utf8")]),
    ] as const) {
      const original: string[] = [];
      postcss.parse(css).walkRules((rule) => {
        for (const selector of rule.selectors) if (selector.includes(`[data-theme="${key}"]`)) original.push(selector);
      });
      expect(original.length, key).toBeGreaterThan(0);
      for (const selector of original) {
        const rewritten = rewriteSelector(selector, key, ["fixture-child"]);
        expect(rewritten, selector).not.toBeNull();
        expect(selectorSpecificity(rewritten!), `${key}: ${selector}`).toEqual(selectorSpecificity(selector));
      }
    }
  });

  it("o codegen pluga a lineage em theme-lineage.generated.css e reporta avisos", () => {
    const pkg = (key: string, extendsKey: string, css: string): ThemePackageInput => ({
      dep: `@venore/theme-${key}`,
      packageJson: { version: "1.0.0", venoreTheme: { contract: "8.0.0", key, extends: extendsKey } },
      resolvable: { manifest: false, theme: true, colorPalettes: false, themeClient: false },
      sourceDir: `../../node_modules/@venore/theme-${key}`,
      themeCss: css,
    });
    const incompleteChild = '[data-theme="fixture-child"] { --primary: oklch(0.5 0.2 300); }';
    const out = buildThemeRegistry(
      [pkg("fixture-parent", "venore-slime", PARENT_CSS), pkg("fixture-child", "fixture-parent", incompleteChild)],
      { strict: true, slimeCss: SLIME_CSS, now: new Date(0) },
    );
    expect(out.lineageCss.startsWith("/* GERADO")).toBe(true);
    expect(out.lineageCss).toContain(':is([data-theme="fixture-parent"],[data-theme="fixture-child"]).dark {');
    expect(out.report.issues).toContainEqual(expect.objectContaining({ level: "warning", themeKey: "fixture-child", code: "incomplete-dark-override" }));
    expect(out.report.excluded).toEqual([]);
  });

  it("sem tema herdando, o arquivo gerado é só o cabeçalho (o registro de hoje)", () => {
    const out = buildThemeLineage(
      Object.entries(THEME_REGISTRY).map(([key, entry]) => ({ key, lineage: entry.contract === 8 ? entry.lineage : [key] })),
    );
    expect(out.css).toBe("");
    expect(out.issues).toEqual([]);
  });
});

// Avaliação da cascata: o <html> com UMA chave (a do filho), jsdom casa os seletores (inclusive
// :is()), a ordem é especificidade → ordem de fonte, e var() é resolvido sobre os valores
// computados do MESMO elemento — como o navegador faz com custom properties.
function computeCustomProperties(css: string, attributes: { theme: string; dark: boolean }): Record<string, string> {
  const dom = new JSDOM(`<!doctype html><html data-theme="${attributes.theme}" class="${attributes.dark ? "dark" : ""}"><body></body></html>`);
  const html = dom.window.document.documentElement;
  type Hit = { specificity: readonly [number, number, number]; order: number; decls: [string, string][] };
  const hits: Hit[] = [];
  let order = 0;
  postcss.parse(css).walkRules((rule) => {
    order++;
    if (rule.parent?.type === "atrule") return; // @media/@supports fora da prova
    const decls: [string, string][] = [];
    rule.each((node) => {
      if (node.type === "decl" && node.prop.startsWith("--")) decls.push([node.prop, node.value]);
    });
    if (decls.length === 0) return;
    const matching = rule.selectors.filter((selector) => html.matches(selector));
    if (matching.length === 0) return;
    const specificity = matching.map(selectorSpecificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    hits.push({ specificity, order, decls });
  });
  hits.sort((a, b) => a.specificity[0] - b.specificity[0] || a.specificity[1] - b.specificity[1] || a.specificity[2] - b.specificity[2] || a.order - b.order);
  const raw: Record<string, string> = {};
  for (const hit of hits) for (const [prop, value] of hit.decls) raw[prop] = value;

  const resolveValue = (value: string, seen: Set<string>): string =>
    value.replace(/var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/gi, (_, name: string, fallback?: string) => {
      if (seen.has(name)) return "";
      const next = raw[name];
      if (next === undefined) return fallback !== undefined ? resolveValue(fallback.trim(), seen) : "";
      return resolveValue(next, new Set([...seen, name]));
    });
  return Object.fromEntries(Object.keys(raw).map((name) => [name, resolveValue(raw[name], new Set([name]))]));
}

describe("tokens derivados com a lineage (spec §3.1)", () => {
  const generated = buildThemeLineage(
    [
      { key: "fixture-parent", lineage: ["fixture-parent", "venore-slime"], css: PARENT_CSS },
      { key: "fixture-child", lineage: ["fixture-child", "fixture-parent", "venore-slime"], css: CHILD_CSS },
    ],
    { "venore-slime": SLIME_CSS },
  ).css;
  // Mesma ordem do globals.css: slime → lineage → theme-imports (pai, filho).
  const stylesheet = [SLIME_CSS, generated, PARENT_CSS, CHILD_CSS].join("\n");
  const slimePrimary = (dark: boolean) => tokenValue(extractRuleBody(SLIME_CSS, `[data-theme="venore-slime"]${dark ? ".dark" : ""}`)!, "--primary");

  it("o filho que troca --primary recolore --chart-1 (declarado só no slime como var(--primary)) — light e dark", () => {
    expect(declaredTokenNames(CHILD_CSS)).not.toContain("--chart-1");
    const light = computeCustomProperties(stylesheet, { theme: "fixture-child", dark: false });
    const dark = computeCustomProperties(stylesheet, { theme: "fixture-child", dark: true });
    expect(light["--primary"]).toBe("oklch(0.5 0.2 300)");
    expect(light["--chart-1"]).toBe("oklch(0.5 0.2 300)");
    expect(dark["--chart-1"]).toBe("oklch(0.72 0.17 300)");
    // Herdado do pai (filho não declara): --primary-foreground e o --background escuro do pai.
    expect(light["--primary-foreground"]).toBe("oklch(0.98 0 0)");
    expect(dark["--background"]).toBe("oklch(0.18 0.02 30)");
    // Herdado do avô (slime): todo o resto do vocabulário.
    expect(light["--chart-2"]).toBe("oklch(0.6 0.12 220)");
  });

  it("o pai sozinho usa o próprio --primary; o slime continua com o dele (a lineage não vaza)", () => {
    expect(computeCustomProperties(stylesheet, { theme: "fixture-parent", dark: false })["--chart-1"]).toBe("oklch(0.55 0.2 30)");
    expect(computeCustomProperties(stylesheet, { theme: "venore-slime", dark: false })["--chart-1"]).toBe(slimePrimary(false));
    expect(computeCustomProperties(stylesheet, { theme: "venore-slime", dark: true })["--chart-1"]).toBe(slimePrimary(true));
  });

  it("sem a lineage o filho não teria --chart-1 (prova de que a herança vem do arquivo gerado)", () => {
    const without = computeCustomProperties([SLIME_CSS, PARENT_CSS, CHILD_CSS].join("\n"), { theme: "fixture-child", dark: false });
    expect(without["--chart-1"]).toBeUndefined();
  });
});

describe("lint de dark incompleto (spec §3.1)", () => {
  it("dispara quando o filho troca T no base, um ancestral flipa T no .dark e o filho não", () => {
    const incomplete = '[data-theme="fixture-child"] { --primary: oklch(0.5 0.2 300); --radius: 1rem; }';
    const issues = lintIncompleteDarkOverrides(["fixture-child", "fixture-parent", "venore-slime"], (key) =>
      key === "fixture-child" ? incomplete : cssOf(key),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "warning", code: "incomplete-dark-override", themeKey: "fixture-child" });
    expect(issues[0].message).toContain("--primary");
    expect(issues[0].message).toContain('"fixture-parent"');
    expect(issues[0].message).not.toContain("--radius"); // ninguém flipa raio no .dark
  });

  it("não dispara pra fixture-child (redeclara --primary no .dark) nem pro pai sobre o slime", () => {
    expect(lintIncompleteDarkOverrides(REGISTRY["fixture-child"].contract === 8 ? REGISTRY["fixture-child"].lineage : [], cssOf)).toEqual([]);
    expect(lintIncompleteDarkOverrides(["fixture-parent", "venore-slime"], cssOf)).toEqual([]);
  });
});

describe("contrato de tokens sobre a cadeia (spec §3.1)", () => {
  const slimeBase = extractRuleBody(SLIME_CSS, `[data-theme="venore-slime"]`)!;
  const slimeDark = extractRuleBody(SLIME_CSS, `[data-theme="venore-slime"].dark`)!;
  const identity = new Set(SLIME_IDENTITY_TOKENS);
  const baseContract = declaredTokenNames(slimeBase).filter((name) => !identity.has(name) && !isOptionalV8Token(name));
  const slimeDarkNames = new Set(declaredTokenNames(slimeDark));
  const darkContract = baseContract.filter((name) => slimeDarkNames.has(name) && isColorValue(tokenValue(slimeBase, name) ?? ""));

  it("o filho (só diffs) cumpre o contrato pela cadeia [filho, pai, slime]", () => {
    const tokens = chainDeclaredTokens(["fixture-child", "fixture-parent", "venore-slime"], cssOf);
    const base = new Set(tokens.base);
    const dark = new Set(tokens.dark);
    expect(baseContract.filter((name) => !base.has(name))).toEqual([]);
    expect(darkContract.filter((name) => !dark.has(name))).toEqual([]);
  });

  it("o theme.css do filho sozinho NÃO cumpre (o contrato é mesmo calculado pela cadeia)", () => {
    const own = new Set(declaredTokenNames(extractRuleBody(CHILD_CSS, `[data-theme="fixture-child"]`)!));
    expect(baseContract.filter((name) => !own.has(name)).length).toBeGreaterThan(50);
  });

  it("um ancestral sem theme.css deixa buraco visível no contrato", () => {
    const tokens = chainDeclaredTokens(["fixture-child", "fixture-parent", "venore-slime"], (key) => (key === "venore-slime" ? undefined : cssOf(key)));
    expect(baseContract.filter((name) => !tokens.base.includes(name)).length).toBeGreaterThan(50);
  });
});
