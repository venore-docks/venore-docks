"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { SchemaForm, type SchemaFormField, type SchemaFormValues } from "@/components/schema-form";
import { saveThemeOptionsAction, type OptionsActionState } from "../_actions/options";

const INITIAL: OptionsActionState = { error: null, fieldErrors: {}, warnings: [], done: false };

// Formulário nativo (FormData) das opções do tema — W2.
export function OptionsForm({ themeKey, fields, values, disabled }: { themeKey: string; fields: SchemaFormField[]; values: SchemaFormValues; disabled?: boolean }) {
  const [state, action, pending] = useActionState(saveThemeOptionsAction, INITIAL);
  // Erros vêm por chave de opção; o formulário usa o nome `option.<key>`.
  const errors = Object.fromEntries(Object.entries(state.fieldErrors).map(([key, message]) => [`option.${key}`, message]));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="themeKey" value={themeKey} />
      <SchemaForm fields={fields} values={values} errors={errors} idPrefix="theme-options" disabled={disabled || pending} />
      <Button type="submit" size="sm" disabled={disabled || pending}>
        Salvar opções no rascunho
      </Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.done && <p className="text-xs text-muted-foreground" aria-live="polite">Opções salvas no rascunho.</p>}
    </form>
  );
}
