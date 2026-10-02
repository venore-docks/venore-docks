"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import type { TextDirectionSetting } from "@/shared/locale";
import { updateLocaleAction, type LocaleActionState } from "../_actions/locale";

const initialState: LocaleActionState = { error: null };

// Sugestões: os locales com catálogo no kit (pt-BR, en, es, ar) e o hebraico (fonte Noto Sans
// Hebrew). Qualquer BCP-47 válido é aceito; sem catálogo, os textos caem no idioma e depois no pt-BR.
const SUGGESTED_LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
  { value: "he", label: "עברית" },
];

const DIRECTIONS: { value: TextDirectionSetting; label: string }[] = [
  { value: "auto", label: "Automática (pelo idioma)" },
  { value: "ltr", label: "Esquerda para a direita" },
  { value: "rtl", label: "Direita para a esquerda" },
];

export function LocaleFormFields({ locale, textDirection }: { locale: string; textDirection: TextDirectionSetting }) {
  const [state, formAction, pending] = useActionState(updateLocaleAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Idioma salvo." });

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 sm:items-end">
      <label className="block space-y-1 text-sm text-muted-foreground">
        <span>Idioma (código BCP-47)</span>
        <Input name="locale" defaultValue={locale} list="locale-suggestions" required maxLength={35} autoComplete="off" />
        <datalist id="locale-suggestions">
          {SUGGESTED_LOCALES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </datalist>
      </label>
      <label className="block space-y-1 text-sm text-muted-foreground">
        <span>Direção do texto</span>
        <select
          name="textDirection"
          defaultValue={textDirection}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {DIRECTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
