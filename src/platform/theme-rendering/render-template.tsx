import { cache, type ReactNode } from "react";
import { headers } from "next/headers";
import type { HeaderUserInfo } from "@/contexts/themes/contracts/types";
import type {
  RegionCommon,
  ResolvedThemeDefinition,
  TemplatePropsByKey,
  ThemeSectionOverride,
  ThemeOutletName,
  ThemeOutletNodes,
  ThemeTemplateKey,
} from "@/contexts/themes/contracts/v8";
import { LEGACY_THEME_OUTLETS } from "@/contexts/themes/contracts/v8";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { resolveDocumentModel } from "./document-model";
import { resolveThemeOutletsFrom } from "./resolve-theme-outlets";
import { resolveThemeStrings } from "./resolve-theme-strings";

// Escolhe o template do tema e renderiza com o dado já resolvido pela página (spec §6 — "pages:
// data unchanged → renderTemplate"). Ordem: variante pedida (se o tema a registrou) → "default"
// do tema → kit (normalizeTemplates já garante "default"). Variante desconhecida nunca quebra a
// página: cai no default.
export function renderTemplate<K extends ThemeTemplateKey>(
  theme: ResolvedThemeDefinition,
  key: K,
  props: TemplatePropsByKey[K],
  options: { variant?: string | null } = {},
): ReactNode {
  const variants = theme.templates[key];
  const Template = (options.variant ? variants[options.variant] : undefined) ?? variants.default;
  return <Template {...props} />;
}

// Variante de template (spec §6/§7.15): a da entry (cms.entries.data.layout.template, guardada
// pelo editor de layout da página) vence a da seção (theme.config sections[].templates[key]).
export function resolveTemplateVariant(
  key: ThemeTemplateKey,
  context: { section: Pick<ThemeSectionOverride, "templates"> | null; entryData?: unknown },
): string | null {
  const fromEntry = readEntryLayoutTemplate(context.entryData);
  if (fromEntry) return fromEntry;
  const fromSection = context.section?.templates?.[key];
  return typeof fromSection === "string" && fromSection.length > 0 ? fromSection : null;
}

function readEntryLayoutTemplate(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const layout = (data as { layout?: unknown }).layout;
  if (!layout || typeof layout !== "object") return null;
  const template = (layout as { template?: unknown }).template;
  return typeof template === "string" && template.trim().length > 0 ? template.trim() : null;
}

export type TemplatePageContext = {
  theme: ResolvedThemeDefinition;
  section: ThemeSectionOverride | null;
  common: RegionCommon;
  nonce: string | undefined;
  pathname: string;
};

// O que toda página com template precisa do documento (tema, strings, locale, opções) — cache()
// por request; resolveDocumentModel já é memoizado e lido pelo root layout.
export const resolveTemplateContext = cache(async (): Promise<TemplatePageContext> => {
  const [doc, requestHeaders] = await Promise.all([resolveDocumentModel(), headers()]);
  return {
    theme: doc.theme,
    section: doc.section,
    common: {
      strings: resolveThemeStrings(doc.theme, doc.locale),
      locale: doc.locale,
      dir: doc.dir,
      options: doc.options.values,
      area: doc.area,
    },
    nonce: requestHeaders.get("x-nonce") ?? undefined,
    pathname: doc.pathname ?? "/",
  };
});

// Outlets que só existem dentro de templates (spec §2.8): o template do kit os desenha mesmo sob
// um Shell 7.x (o adapter só embrulha o conteúdo, mas a página continua usando o template do kit).
export const PAGE_TEMPLATE_OUTLETS: readonly ThemeOutletName[] = ["home.showcase", "entry.after-content"];

// Usuário do request no formato do contexto de outlet (o mesmo que o header recebe).
export function toOutletUser(user: { name: string | null; email: string | null } | null): HeaderUserInfo | null {
  if (!user) return null;
  return { displayName: user.name ?? user.email ?? "", email: user.email, imageUrl: null };
}

// Nós de outlet de plugin para uma página com template — mesma seleção/ordem/timeout do layout
// (resolve-theme-outlets, W7). Os nós são lazy: só o outlet que o template desenha executa.
export async function resolvePageOutlets(
  context: TemplatePageContext,
  viewer: { user: HeaderUserInfo | null; canAccessAdmin: boolean },
): Promise<ThemeOutletNodes> {
  const outletsRendered = context.theme.legacyShell
    ? [...LEGACY_THEME_OUTLETS, ...PAGE_TEMPLATE_OUTLETS]
    : context.theme.outletsRendered;
  return resolveThemeOutletsFrom(
    PLUGIN_CONTRIBUTIONS,
    await getActivePluginKeys(),
    {
      pathname: context.pathname,
      area: context.common.area,
      user: viewer.user,
      canAccessAdmin: viewer.canAccessAdmin,
      themeKey: context.theme.key,
      locale: context.common.locale,
    },
    { outletsRendered },
  );
}
