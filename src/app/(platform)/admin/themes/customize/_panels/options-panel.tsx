"use client";

import { SchemaForm } from "@/components/schema-form";
import type { ThemeOptionValue } from "@/contexts/themes/contracts/v8";
import { THEME_OPTION_FORM_PREFIX, toSchemaFormFields, toSchemaFormValues } from "@/platform/theme-engine/theme-options";
import { PANEL_CLASS } from "../_components/field-styles";
import type { DraftPanelProps } from "./types";

// Painel "Opções do tema" de /admin/themes/customize (spec v8 §9, dono W2). Edita
// byTheme[tema].options do rascunho; a mudança é instantânea no preview (PreviewBridge) e só é
// gravada quando o workspace salva.
export function OptionsPanel({ draft, theme, onChange }: DraftPanelProps) {
  if (theme.options.length === 0) return null;
  const entry = draft.byTheme[theme.key];
  const setValue = (name: string, value: ThemeOptionValue) => {
    const key = name.slice(THEME_OPTION_FORM_PREFIX.length);
    onChange({
      byTheme: {
        ...draft.byTheme,
        [theme.key]: { palette: entry?.palette ?? { mode: "default" }, fonts: entry?.fonts ?? {}, options: { ...entry?.options, [key]: value } },
      },
    });
  };
  return (
    <section className={PANEL_CLASS} aria-labelledby="customize-options-title">
      <h2 id="customize-options-title" className="text-sm font-semibold text-foreground">
        Opções do tema
      </h2>
      <SchemaForm
        fields={toSchemaFormFields(theme)}
        values={toSchemaFormValues(theme.options, entry?.options)}
        onChange={setValue}
        idPrefix="customize-options"
      />
    </section>
  );
}
