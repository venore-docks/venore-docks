"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { applyPresetPaletteAction, type ThemesActionState } from "../actions";

const initialState: ThemesActionState = { error: null };

// Distinto de ActivateColorPaletteButton (que só troca o paletteId salvo): este gera a paleta
// completa a partir do preset e salva como "Personalizada" — por isso usa applyPresetPaletteAction,
// não activateColorPaletteAction. Ver brand-color-palette.ts (setPresetColorPalette).
export function ApplyPresetPaletteButton({ paletteId }: { paletteId: string }) {
  const [state, formAction, pending] = useActionState(applyPresetPaletteAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Paleta aplicada." });

  return (
    <form action={formAction}>
      <input type="hidden" name="paletteId" value={paletteId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Usar
      </Button>
    </form>
  );
}
