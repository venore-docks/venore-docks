"use client";

import { FONT_ROLES, type FontId, type FontRole, type ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import { FONT_CATALOG, fontOptionsForRole } from "@/platform/theme-fonts/catalog";
import { NATIVE_FIELD_CLASS, PANEL_CLASS } from "../_components/field-styles";
import type { DraftPanelProps } from "./types";

// Painel "Fontes" de /admin/themes/customize (spec v8 §7.6/§9). Dono: W8. Edita
// `byTheme[tema].fonts` do rascunho — a camada mais forte (manifesto ← opção `font` ← config).
// "Padrão do tema" apaga a escolha do papel. Só devolve patch; salvar/recarregar é da página (W6).
// O admin continua sempre em Geist; a escolha vale para o site público.

const ROLE_LABELS: Record<FontRole, { label: string; hint: string }> = {
  sans: { label: "Texto", hint: "Corpo do texto e interface do site." },
  display: { label: "Títulos", hint: "Sem escolha, segue a fonte de texto." },
  mono: { label: "Código", hint: "Blocos e trechos de código." },
};

export function withFontChoice(draft: ThemeConfigDocument, themeKey: string, role: FontRole, font: FontId | null): Pick<ThemeConfigDocument, "byTheme"> {
  const entry = draft.byTheme[themeKey] ?? { palette: { mode: "default" as const }, options: {}, fonts: {} };
  const fonts = { ...entry.fonts };
  if (font) fonts[role] = font;
  else delete fonts[role];
  return { byTheme: { ...draft.byTheme, [themeKey]: { ...entry, fonts } } };
}

export function FontsPanel({ draft, theme, onChange }: DraftPanelProps) {
  if (theme.contract === 7) {
    return (
      <section className={PANEL_CLASS} aria-labelledby="customize-fonts-title">
        <h2 id="customize-fonts-title" className="text-sm font-semibold text-foreground">
          Fontes
        </h2>
        <p className="text-xs text-muted-foreground">Este tema (contrato 7.x) define as próprias fontes; não há escolha por papel.</p>
      </section>
    );
  }

  const stored = draft.byTheme[theme.key]?.fonts ?? {};
  return (
    <section className={PANEL_CLASS} aria-labelledby="customize-fonts-title">
      <h2 id="customize-fonts-title" className="text-sm font-semibold text-foreground">
        Fontes
      </h2>
      <p className="text-xs text-muted-foreground">
        Valem para o site público (o painel continua em Geist). Para árabe ou hebraico, use Noto Sans Arabic ou Noto Sans Hebrew. Salve o
        rascunho para ver a fonte no preview.
      </p>
      {FONT_ROLES.map((role) => {
        const fieldId = `customize-font-${role}`;
        const themeDefault = theme.fonts[role];
        return (
          <div key={role} className="space-y-1">
            <label htmlFor={fieldId} className="block text-sm text-foreground">
              {ROLE_LABELS[role].label}
            </label>
            <select
              id={fieldId}
              className={NATIVE_FIELD_CLASS}
              value={stored[role] ?? ""}
              onChange={(event) => onChange(withFontChoice(draft, theme.key, role, (event.target.value || null) as FontId | null))}
            >
              <option value="">Padrão do tema ({FONT_CATALOG[themeDefault]?.label ?? "Geist"})</option>
              {fontOptionsForRole(role, theme.fontChoices).map((id) => (
                <option key={id} value={id}>
                  {FONT_CATALOG[id].label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role].hint}</p>
          </div>
        );
      })}
    </section>
  );
}
