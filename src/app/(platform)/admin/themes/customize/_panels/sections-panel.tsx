"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PAGE_WIDTHS,
  THEME_CONFIG_MAX_SECTIONS,
  THEME_LAYOUT_PRESETS,
  THEME_MOBILE_NAV_MODES,
  THEME_TEMPLATE_KEYS,
  type ThemeSectionOverride,
} from "@/contexts/themes/contracts/v8";
import type { ThemeCustomizeChoice } from "@/platform/theme-engine/theme-config";
import { normalizePathPrefix } from "@/shared/normalize-path-prefix";
import { NATIVE_FIELD_CLASS, PANEL_CLASS } from "../_components/field-styles";
import type { DraftPanelProps } from "./types";

const TEMPLATE_LABELS: Record<string, string> = {
  home: "Início",
  entry: "Página",
  category: "Categoria",
  account: "Conta",
  login: "Login",
  notFound: "Não encontrada",
};
const WIDTH_LABELS: Record<string, string> = { contained: "Contida", wide: "Larga", full: "Tela cheia" };
const PLACEMENT_LABELS: Record<string, string> = { side: "Lateral", top: "No topo", none: "Oculta" };
// Espelho de RESERVED_SECTION_SEGMENTS (contexts/themes/.../section-rules.ts) só para o aviso
// imediato no formulário — quem recusa de verdade é o servidor ao salvar.
const RESERVED_FIRST_SEGMENTS = ["admin", "ext", "api", "login", "_next"];

function reservedHint(prefix: string): string | null {
  const normalized = normalizePathPrefix(prefix);
  if (normalized === "/") return "Use um caminho como /rh — a raiz é o site inteiro.";
  return RESERVED_FIRST_SEGMENTS.includes(normalized.split("/")[1] ?? "") ? `"${normalized}" é reservado.` : null;
}

function newSection(): ThemeSectionOverride {
  return { id: `s-${crypto.randomUUID().slice(0, 8)}`, label: "Nova seção", pathPrefix: "/nova-secao" };
}

function SectionEditor({
  section,
  themes,
  templateVariants,
  onSave,
  onRemove,
}: {
  section: ThemeSectionOverride;
  themes: ThemeCustomizeChoice[];
  templateVariants: DraftPanelProps["theme"]["templateVariants"];
  onSave: (section: ThemeSectionOverride) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(section);
  const hint = reservedHint(value.pathPrefix);
  const set = <K extends keyof ThemeSectionOverride>(key: K, next: ThemeSectionOverride[K] | undefined) =>
    setValue((current) => {
      const copy = { ...current };
      if (next === undefined || next === "") delete copy[key];
      else copy[key] = next;
      return copy;
    });
  const setPage = (key: "width" | "showRail" | "contextualPlacement", next: string) =>
    setValue((current) => {
      const page: NonNullable<ThemeSectionOverride["page"]> = { ...current.page };
      if (next === "") delete page[key];
      else if (key === "showRail") page.showRail = next === "true";
      else if (key === "width") page.width = next as NonNullable<typeof page.width>;
      else page.contextualPlacement = next as NonNullable<typeof page.contextualPlacement>;
      const { page: _previous, ...rest } = current;
      void _previous;
      return Object.keys(page).length === 0 ? rest : { ...rest, page };
    });
  const setTemplate = (key: string, next: string) =>
    setValue((current) => {
      const templates = { ...current.templates } as Record<string, string>;
      if (next === "") delete templates[key];
      else templates[key] = next;
      const { templates: _previous, ...rest } = current;
      void _previous;
      return Object.keys(templates).length === 0 ? rest : { ...rest, templates };
    });

  return (
    <fieldset className="space-y-2 rounded-lg border border-border ui-panel-padding">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{section.label}</legend>
      <label className="block space-y-1 text-sm text-foreground">
        <span>Nome</span>
        <input className={NATIVE_FIELD_CLASS} value={value.label} maxLength={120} onChange={(event) => set("label", event.target.value)} />
      </label>
      <label className="block space-y-1 text-sm text-foreground">
        <span>Caminho</span>
        <input
          className={NATIVE_FIELD_CLASS}
          value={value.pathPrefix}
          maxLength={512}
          aria-invalid={hint ? true : undefined}
          onChange={(event) => set("pathPrefix", event.target.value)}
        />
        <span className="block text-xs text-muted-foreground">
          Vale para {normalizePathPrefix(value.pathPrefix)} e tudo abaixo. {hint && <span className="text-destructive">{hint}</span>}
        </span>
      </label>
      <label className="block space-y-1 text-sm text-foreground">
        <span>Tema</span>
        <select className={NATIVE_FIELD_CLASS} value={value.themeKey ?? ""} onChange={(event) => set("themeKey", event.target.value)}>
          <option value="">Mesmo do site</option>
          {themes.map((choice) => (
            <option key={choice.key} value={choice.key}>
              {choice.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block space-y-1 text-sm text-foreground">
          <span>Layout</span>
          <select
            className={NATIVE_FIELD_CLASS}
            value={value.layoutPreset ?? ""}
            onChange={(event) => set("layoutPreset", (event.target.value || undefined) as ThemeSectionOverride["layoutPreset"])}
          >
            <option value="">Padrão</option>
            {THEME_LAYOUT_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm text-foreground">
          <span>Navegação no celular</span>
          <select
            className={NATIVE_FIELD_CLASS}
            value={value.mobileNav ?? ""}
            onChange={(event) => set("mobileNav", (event.target.value || undefined) as ThemeSectionOverride["mobileNav"])}
          >
            <option value="">Padrão</option>
            {THEME_MOBILE_NAV_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm text-foreground">
          <span>Largura da página</span>
          <select className={NATIVE_FIELD_CLASS} value={value.page?.width ?? ""} onChange={(event) => setPage("width", event.target.value)}>
            <option value="">Padrão</option>
            {PAGE_WIDTHS.map((width) => (
              <option key={width} value={width}>
                {WIDTH_LABELS[width] ?? width}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm text-foreground">
          <span>Menu lateral</span>
          <select
            className={NATIVE_FIELD_CLASS}
            value={value.page?.showRail === undefined ? "" : String(value.page.showRail)}
            onChange={(event) => setPage("showRail", event.target.value)}
          >
            <option value="">Padrão</option>
            <option value="true">Mostrar</option>
            <option value="false">Ocultar</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm text-foreground">
          <span>Barra contextual</span>
          <select
            className={NATIVE_FIELD_CLASS}
            value={value.page?.contextualPlacement ?? ""}
            onChange={(event) => setPage("contextualPlacement", event.target.value)}
          >
            <option value="">Padrão</option>
            {Object.entries(PLACEMENT_LABELS).map(([placement, label]) => (
              <option key={placement} value={placement}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {THEME_TEMPLATE_KEYS.filter((key) => (templateVariants[key]?.length ?? 0) > 0).map((key) => (
        <label key={key} className="block space-y-1 text-sm text-foreground">
          <span>Modelo de {TEMPLATE_LABELS[key] ?? key}</span>
          <select className={NATIVE_FIELD_CLASS} value={value.templates?.[key] ?? ""} onChange={(event) => setTemplate(key, event.target.value)}>
            <option value="">Padrão</option>
            {(templateVariants[key] ?? []).map((variant) => (
              <option key={variant.value} value={variant.value}>
                {typeof variant.label === "string" ? variant.label : variant.value}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={Boolean(hint)} onClick={() => onSave({ ...value, pathPrefix: normalizePathPrefix(value.pathPrefix) })}>
          Aplicar seção
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          Remover
        </Button>
      </div>
    </fieldset>
  );
}

// Painel "Seções do site com tema/layout próprios" (spec v8 §7.3/§9, dono W6). Cada seção vale
// para um prefixo de caminho (o mais longo vence). Aplicar/remover salva o rascunho e recarrega a
// pré-visualização (mudança estrutural). Variantes de modelo listadas são as do tema do site;
// variante que o tema da seção não oferece é descartada (com aviso) ao salvar.
export function SectionsPanel({ draft, theme, onChange, themes }: DraftPanelProps & { themes: ThemeCustomizeChoice[] }) {
  const replace = (index: number, next: ThemeSectionOverride | null) => {
    const sections = [...draft.sections];
    if (next) sections[index] = next;
    else sections.splice(index, 1);
    onChange({ sections });
  };

  return (
    <section className={PANEL_CLASS} aria-labelledby="customize-sections-title">
      <h2 id="customize-sections-title" className="text-sm font-semibold text-foreground">
        Seções do site
      </h2>
      <p className="text-xs text-muted-foreground">
        Uma seção muda tema, layout ou modelos só num pedaço do site (ex: /rh). Caminhos /admin, /ext, /api e /login são reservados.
      </p>
      {draft.sections.map((section, index) => (
        <SectionEditor
          key={`${section.id}:${section.pathPrefix}`}
          section={section}
          themes={themes}
          templateVariants={theme.templateVariants}
          onSave={(next) => replace(index, next)}
          onRemove={() => replace(index, null)}
        />
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={draft.sections.length >= THEME_CONFIG_MAX_SECTIONS}
        onClick={() => onChange({ sections: [...draft.sections, newSection()] })}
      >
        Adicionar seção
      </Button>
    </section>
  );
}
