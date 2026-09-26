"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import type { PaletteColorToken, PaletteColorTokens } from "@/contexts/themes";
import { updateCustomColorPaletteAction, type ThemesActionState } from "../actions";

const initialState: ThemesActionState = { error: null };

// Grupos visuais dos 25 tokens de PaletteColorToken (ampliado — ver custom-color-palette.ts):
// "Marca" é o que o fluxo "1 cor de marca" (brand-color-palette-form.tsx) já deriva
// automaticamente a partir do matiz complementar; "Superfícies" é o vocabulário mínimo que todo
// tema já é obrigado a fornecer (card/popover/muted/border/input, VENORE-DOCKS.md §7); "Sidebar,
// header e fundo" é a família de tokens que ficava fora do alcance da paleta até esta sessão
// ("a paleta muda só alguns elementos, sidebar nunca muda") — cada um aqui dá pra ajustar à mão
// além do que a derivação automática cobre.
const FIELD_GROUPS: { label: string; fields: { token: PaletteColorToken; label: string }[] }[] = [
  {
    label: "Marca",
    fields: [
      { token: "primary", label: "Primária" },
      { token: "primary-foreground", label: "Primária (texto)" },
      { token: "accent", label: "Destaque" },
      { token: "accent-foreground", label: "Destaque (texto)" },
      { token: "ring", label: "Foco (ring)" },
    ],
  },
  {
    label: "Estrutura",
    fields: [
      { token: "secondary", label: "Secundária" },
      { token: "secondary-foreground", label: "Secundária (texto)" },
      { token: "background", label: "Fundo" },
      { token: "foreground", label: "Texto" },
    ],
  },
  {
    label: "Superfícies",
    fields: [
      { token: "card", label: "Card" },
      { token: "card-foreground", label: "Card (texto)" },
      { token: "popover", label: "Popover" },
      { token: "popover-foreground", label: "Popover (texto)" },
      { token: "muted", label: "Muted" },
      { token: "muted-foreground", label: "Muted (texto)" },
      { token: "border", label: "Borda" },
      { token: "input", label: "Input" },
    ],
  },
  {
    label: "Sidebar, header e fundo",
    fields: [
      { token: "sidebar-bg-start", label: "Sidebar (início)" },
      { token: "sidebar-bg-end", label: "Sidebar (fim)" },
      { token: "sidebar-bg-admin-start", label: "Sidebar admin (início)" },
      { token: "sidebar-bg-admin-end", label: "Sidebar admin (fim)" },
      { token: "header-bg", label: "Header" },
      { token: "app-bg-start", label: "Fundo da página (início)" },
      { token: "app-bg-mid", label: "Fundo da página (meio)" },
      { token: "app-bg-end", label: "Fundo da página (fim)" },
    ],
  },
];

// input type=color só aceita/produz #rrggbb — por isso o fallback abaixo (quando o admin nunca
// salvou um valor pra esse token) precisa ser um hex fixo, não a var() do tema ativo (que pode
// ser oklch, formato que o picker nativo do navegador não entende).
const UNSET_FALLBACK = "#000000";

function ColorModeFields({ mode, tokens }: { mode: "light" | "dark"; tokens: PaletteColorTokens }) {
  return (
    <div className="space-y-4">
      {FIELD_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-[0.65rem] font-medium uppercase tracking-caps text-muted-foreground/72">{group.label}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.fields.map(({ token, label: fieldLabel }) => (
              <label key={token} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="color"
                  name={`${mode}-${token}`}
                  defaultValue={tokens[token] ?? UNSET_FALLBACK}
                  className="h-9 w-full cursor-pointer rounded-md border border-border bg-transparent outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
                />
                {fieldLabel}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomColorPaletteForm({ light, dark }: { light: PaletteColorTokens; dark: PaletteColorTokens }) {
  const [state, formAction, pending] = useActionState(updateCustomColorPaletteAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Cores personalizadas salvas e aplicadas." });

  return (
    <details className="mt-4 rounded-lg border border-border bg-background p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">Avançado</summary>
      <form action={formAction} className="mt-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Ajusta cada token individualmente. Salvar aplica automaticamente — não precisa clicar em &quot;Usar&quot; na
          lista acima.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Modo claro</p>
            <ColorModeFields mode="light" tokens={light} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Modo escuro</p>
            <ColorModeFields mode="dark" tokens={dark} />
          </div>
        </div>

        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Salvar e aplicar
        </Button>
      </form>
    </details>
  );
}
