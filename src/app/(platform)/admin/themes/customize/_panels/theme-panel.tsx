"use client";

import { emptyThemeConfigEntry, type ThemeConfigByTheme, type ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import type { ThemeCustomizeChoice } from "@/platform/theme-engine/theme-config";
import { NATIVE_FIELD_CLASS, PANEL_CLASS } from "../_components/field-styles";
import type { DraftPanelProps } from "./types";

const LAYOUT_LABELS: Record<string, string> = { topbar: "Barra no topo", rail: "Trilho lateral" };
const MOBILE_NAV_LABELS: Record<string, string> = { drawer: "Gaveta", "bottom-bar": "Barra inferior", fullscreen: "Tela cheia" };

// Ao escolher um tema pela primeira vez no rascunho, a config dele nasce da do tema pai (spec
// §7.1, "stored values"): paleta/opções/fontes do pai, quando houver.
export function withThemeSelected(draft: ThemeConfigDocument, themeKey: string, chain: readonly string[]): Partial<ThemeConfigDocument> {
  if (draft.byTheme[themeKey]) return { themeKey };
  const parentEntry = chain.slice(1).map((key) => draft.byTheme[key]).find(Boolean);
  const seeded: ThemeConfigByTheme = parentEntry ? structuredClone(parentEntry) : emptyThemeConfigEntry();
  return { themeKey, byTheme: { ...draft.byTheme, [themeKey]: seeded } };
}

// Painel "Tema do site" (spec v8 §9, dono W6): troca de tema e, quando o tema oferece escolha,
// preset de layout e modo da navegação mobile (opções reservadas `layout`/`mobile-nav`).
export function ThemePanel({ draft, theme, onChange, themes }: DraftPanelProps & { themes: ThemeCustomizeChoice[] }) {
  const entry = draft.byTheme[theme.key] ?? emptyThemeConfigEntry();
  const setReservedOption = (key: "layout" | "mobile-nav", value: string) => {
    const options = { ...entry.options };
    if (value === "") delete options[key];
    else options[key] = value;
    onChange({ byTheme: { ...draft.byTheme, [theme.key]: { ...entry, options } } });
  };
  const current = themes.some((choice) => choice.key === draft.themeKey);

  return (
    <section className={PANEL_CLASS} aria-labelledby="customize-theme-title">
      <h2 id="customize-theme-title" className="text-sm font-semibold text-foreground">
        Tema do site
      </h2>
      <label className="block space-y-1 text-sm text-foreground">
        <span>Tema</span>
        <select
          className={NATIVE_FIELD_CLASS}
          value={draft.themeKey}
          onChange={(event) => {
            const choice = themes.find((candidate) => candidate.key === event.target.value);
            if (choice) onChange(withThemeSelected(draft, choice.key, choice.chain));
          }}
        >
          {!current && <option value={draft.themeKey}>{draft.themeKey} (indisponível)</option>}
          {themes.map((choice) => (
            <option key={choice.key} value={choice.key}>
              {choice.name} {choice.contract === 7 ? "(v7)" : ""}
            </option>
          ))}
        </select>
      </label>
      {theme.layoutDecl.presetChoices.length > 0 && (
        <label className="block space-y-1 text-sm text-foreground">
          <span>Layout</span>
          <select
            className={NATIVE_FIELD_CLASS}
            value={typeof entry.options.layout === "string" ? entry.options.layout : ""}
            onChange={(event) => setReservedOption("layout", event.target.value)}
          >
            <option value="">Padrão do tema</option>
            {theme.layoutDecl.presetChoices.map((preset) => (
              <option key={preset} value={preset}>
                {LAYOUT_LABELS[preset] ?? preset}
              </option>
            ))}
          </select>
        </label>
      )}
      {theme.responsive.mobileNavChoices.length > 0 && (
        <label className="block space-y-1 text-sm text-foreground">
          <span>Navegação no celular</span>
          <select
            className={NATIVE_FIELD_CLASS}
            value={typeof entry.options["mobile-nav"] === "string" ? entry.options["mobile-nav"] : ""}
            onChange={(event) => setReservedOption("mobile-nav", event.target.value)}
          >
            <option value="">Padrão do tema</option>
            {theme.responsive.mobileNavChoices.map((mode) => (
              <option key={mode} value={mode}>
                {MOBILE_NAV_LABELS[mode] ?? mode}
              </option>
            ))}
          </select>
        </label>
      )}
      {theme.contract === 7 && (
        <p className="text-xs text-muted-foreground">Tema 7.x: layout, opções e fontes são os do próprio pacote.</p>
      )}
    </section>
  );
}
