import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageStateProps } from "@/contexts/themes/contracts/v8";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";
import { normalizeThemeDefinition } from "./normalize-entry";

// renderTemplate/renderState (spec v8 §6/§7.9), manutenção (§4.1) e JSON-LD de template (§7.7).
const settings = vi.hoisted(() => ({ value: undefined as unknown, fail: false }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("./document-model", () => ({ resolveDocumentModel: async () => ({}) }));
vi.mock("@/contexts/settings", () => ({
  CORE_SETTING_DEFAULTS: { "platform.maintenance": { enabled: false, message: "" } },
  getSetting: async () =>
    settings.fail
      ? { success: false, error: { code: "x", message: "x" } }
      : { success: true, data: settings.value === undefined ? null : { key: "platform.maintenance", value: settings.value } },
}));

const { renderTemplate, resolveTemplateVariant } = await import("./render-template");
const { renderState } = await import("./render-state");
const { parseMaintenanceSetting, resolveMaintenance } = await import("./resolve-maintenance");
const { buildTemplateJsonLd } = await import("./template-json-ld");

async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement(node)) return node;
  const element = node as ReactElement;
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
    return resolveAsync(await (element.type as (props: unknown) => Promise<ReactNode>)(element.props));
  }
  return element;
}

const common = { strings: KIT_STRINGS_PT_BR, locale: "pt-BR", dir: "ltr" as const, options: {}, area: "public" as const };
const stateProps = (overrides: Partial<PageStateProps> = {}): PageStateProps => ({
  ...common,
  title: "Em manutenção",
  message: null,
  action: null,
  ...overrides,
});
const kit = () => normalizeThemeDefinition("venore-slime", venoreSlimeTheme, ["venore-slime"]);

beforeEach(() => {
  settings.value = undefined;
  settings.fail = false;
});

describe("renderTemplate", () => {
  const notFoundProps = { ...common, homeHref: "/", jsonLd: null, outlets: { before: null, after: null } };

  it("variante registrada → variante; ausente/desconhecida → default do tema → kit", () => {
    const theme = normalizeThemeDefinition(
      "t",
      { ...venoreSlimeTheme, templates: { notFound: { default: () => <p>default</p>, compacto: () => <p>compacto</p> } } },
      ["t"],
    );
    expect(renderToStaticMarkup(<>{renderTemplate(theme, "notFound", notFoundProps, { variant: "compacto" })}</>)).toBe("<p>compacto</p>");
    expect(renderToStaticMarkup(<>{renderTemplate(theme, "notFound", notFoundProps, { variant: "outra" })}</>)).toBe("<p>default</p>");
    expect(renderToStaticMarkup(<>{renderTemplate(kit(), "notFound", notFoundProps, { variant: "compacto" })}</>)).toContain(
      "Página não encontrada",
    );
  });

  it("resolveTemplateVariant: entry (data.layout.template) vence a seção", () => {
    const section = { templates: { entry: "wide" } };
    expect(resolveTemplateVariant("entry", { section, entryData: { layout: { template: " hero " } } })).toBe("hero");
    expect(resolveTemplateVariant("entry", { section, entryData: { layout: {} } })).toBe("wide");
    expect(resolveTemplateVariant("category", { section, entryData: null })).toBeNull();
    expect(resolveTemplateVariant("entry", { section: null, entryData: { layout: { template: 3 } } })).toBeNull();
  });
});

describe("renderState", () => {
  it("o estado do tema substitui o do kit", () => {
    const theme = normalizeThemeDefinition("t", { ...venoreSlimeTheme, states: { forbidden: ({ title }) => <p>{title}!</p> } }, ["t"]);
    expect(renderToStaticMarkup(<>{renderState(theme, "forbidden", stateProps({ title: "Sem acesso" }))}</>)).toBe("<p>Sem acesso!</p>");
  });

  it("empty do kit = o desenho de components/empty-state", () => {
    const markup = renderToStaticMarkup(<>{renderState(kit(), "empty", stateProps({ title: "Vazio", message: "Nada aqui" }))}</>);
    expect(markup).toContain('class="flex flex-col items-center gap-3 rounded-panel border border-dashed');
    expect(markup).toContain("Nada aqui");
  });

  it("manutenção sem mensagem usa a mensagem configurada (ou o texto padrão)", async () => {
    settings.value = { enabled: true, message: "Voltamos às 18h." };
    const html = renderToStaticMarkup(<>{await resolveAsync(renderState(kit(), "maintenance", stateProps()))}</>);
    expect(html).toContain('role="status"');
    expect(html).toContain("Em manutenção");
    expect(html).toContain("Voltamos às 18h.");
  });
});

describe("modo manutenção", () => {
  it("só esconde o conteúdo de quem não tem acesso ao admin", async () => {
    settings.value = { enabled: true, message: "" };
    expect(await resolveMaintenance({ granted: false })).toBe(true);
    expect(await resolveMaintenance({ granted: true })).toBe(false);
  });

  it("desligado, ausente, malformado ou erro de leitura = sem manutenção", async () => {
    settings.value = { enabled: false, message: "x" };
    expect(await resolveMaintenance({ granted: false })).toBe(false);
    settings.value = undefined;
    expect(await resolveMaintenance({ granted: false })).toBe(false);
    settings.value = "true";
    expect(await resolveMaintenance({ granted: false })).toBe(false);
    settings.fail = true;
    expect(await resolveMaintenance({ granted: false })).toBe(false);
  });

  it("parseMaintenanceSetting só aceita enabled === true e corta a mensagem", () => {
    expect(parseMaintenanceSetting({ enabled: "yes", message: 1 })).toEqual({ enabled: false, message: "" });
    expect(parseMaintenanceSetting({ enabled: true, message: "a".repeat(600) }).message).toHaveLength(500);
  });
});

describe("buildTemplateJsonLd", () => {
  const seo = (structuredData = {}) => ({ seo: { structuredData } });

  it("padrões: WebSite, Article, CollectionPage", () => {
    expect(buildTemplateJsonLd(seo(), { kind: "home", siteName: "S", url: "https://s/" })).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "S",
      url: "https://s/",
    });
    expect(
      buildTemplateJsonLd(seo(), { kind: "entry", title: "T", url: "https://s/t", publishedAt: "2026-01-01T00:00:00.000Z", updatedAt: null, image: null }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "T",
      url: "https://s/t",
      mainEntityOfPage: "https://s/t",
      datePublished: "2026-01-01T00:00:00.000Z",
      dateModified: "2026-01-01T00:00:00.000Z",
    });
    expect(buildTemplateJsonLd(seo(), { kind: "category", name: "Blog", url: "https://s/blog", description: null })).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Blog",
      url: "https://s/blog",
    });
  });

  it("tipos declarados pelo tema: Organization (com logo), WebPage (name), Blog", () => {
    const theme = seo({ home: "Organization", entry: "WebPage", category: "Blog" });
    expect(buildTemplateJsonLd(theme, { kind: "home", siteName: "S", url: "https://s/", logoUrl: "https://s/l.png" })).toMatchObject({
      "@type": "Organization",
      logo: "https://s/l.png",
    });
    const page = buildTemplateJsonLd(theme, { kind: "entry", title: "T", url: "u", publishedAt: null, updatedAt: null, image: null });
    expect(page).toMatchObject({ "@type": "WebPage", name: "T" });
    expect(page).not.toHaveProperty("headline");
    expect(buildTemplateJsonLd(theme, { kind: "category", name: "B", url: "u", description: "d" })).toMatchObject({ "@type": "Blog" });
  });
});
