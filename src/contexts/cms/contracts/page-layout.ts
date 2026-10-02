import type { PageWidth } from "@/contexts/themes/contracts/v8/enums";

// Layout por página, guardado em cms.entries.data.layout (spec v8 §4.5 — sem migration). Dono: W5.
// Todo campo é opcional: ausente (ou "auto") = herda da seção do tema, depois do padrão do tema.
export type PageLayout = {
  width?: PageWidth;
  rail?: "auto" | "hidden";
  contextualBar?: "auto" | "side" | "top" | "none";
  template?: string; // valor de templateVariants do tema
};
export const ENTRY_LAYOUT_DATA_KEY = "layout";

export const PAGE_LAYOUT_WIDTHS: readonly PageWidth[] = ["contained", "wide", "full"];
export const PAGE_LAYOUT_RAIL_VALUES: readonly NonNullable<PageLayout["rail"]>[] = ["auto", "hidden"];
export const PAGE_LAYOUT_CONTEXTUAL_VALUES: readonly NonNullable<PageLayout["contextualBar"]>[] = ["auto", "side", "top", "none"];
// Variante de template é um identificador do manifesto do tema (não um texto livre); o cms não
// conhece os temas, então só checa o formato — a validação contra o tema ativo é de quem renderiza
// (variante desconhecida cai no template padrão, renderTemplate/W4).
export const PAGE_LAYOUT_TEMPLATE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export type ParsePageLayoutResult = { success: true; data: PageLayout } | { success: false; field: keyof PageLayout | "layout" };

// Parse estrito do que vem da borda (editor/ação): rejeita chave desconhecida e valor fora do
// vocabulário. Campo vazio/"auto" vira ausente — o dado guardado só tem o que de fato sobrepõe.
export function parsePageLayout(input: unknown): ParsePageLayoutResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { success: false, field: "layout" };
  const raw = input as Record<string, unknown>;
  const allowed = new Set(["width", "rail", "contextualBar", "template"]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) return { success: false, field: "layout" };

  const layout: PageLayout = {};
  if (raw.width !== undefined && raw.width !== "") {
    if (!includes(PAGE_LAYOUT_WIDTHS, raw.width)) return { success: false, field: "width" };
    layout.width = raw.width;
  }
  if (raw.rail !== undefined && raw.rail !== "" && raw.rail !== "auto") {
    if (!includes(PAGE_LAYOUT_RAIL_VALUES, raw.rail)) return { success: false, field: "rail" };
    layout.rail = raw.rail;
  }
  if (raw.contextualBar !== undefined && raw.contextualBar !== "" && raw.contextualBar !== "auto") {
    if (!includes(PAGE_LAYOUT_CONTEXTUAL_VALUES, raw.contextualBar)) return { success: false, field: "contextualBar" };
    layout.contextualBar = raw.contextualBar;
  }
  if (raw.template !== undefined && raw.template !== "" && raw.template !== "default") {
    if (typeof raw.template !== "string" || !PAGE_LAYOUT_TEMPLATE_PATTERN.test(raw.template)) return { success: false, field: "template" };
    layout.template = raw.template;
  }
  return { success: true, data: layout };
}

// Leitura tolerante do que já está guardado em entries.data (render path): valor inválido é
// ignorado campo a campo, nunca derruba a página.
export function readEntryPageLayout(data: unknown): PageLayout {
  if (typeof data !== "object" || data === null) return {};
  const stored = (data as Record<string, unknown>)[ENTRY_LAYOUT_DATA_KEY];
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  const raw = stored as Record<string, unknown>;
  const layout: PageLayout = {};
  if (includes(PAGE_LAYOUT_WIDTHS, raw.width)) layout.width = raw.width;
  if (includes(PAGE_LAYOUT_RAIL_VALUES, raw.rail)) layout.rail = raw.rail;
  if (includes(PAGE_LAYOUT_CONTEXTUAL_VALUES, raw.contextualBar)) layout.contextualBar = raw.contextualBar;
  if (typeof raw.template === "string" && PAGE_LAYOUT_TEMPLATE_PATTERN.test(raw.template)) layout.template = raw.template;
  return layout;
}
