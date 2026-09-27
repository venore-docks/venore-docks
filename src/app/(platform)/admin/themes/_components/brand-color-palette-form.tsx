"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateBrandColorPaletteAction, type ThemesActionState } from "../actions";

const initialState: ThemesActionState = { error: null };

export function BrandColorPaletteForm({ hex }: { hex: string }) {
  const [state, formAction, pending] = useActionState(updateBrandColorPaletteAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Cor de marca aplicada." });

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4">
      <label className="flex items-center gap-2 text-sm text-foreground">
        Cor de marca
        <input
          type="color"
          name="hex"
          defaultValue={hex}
          className="h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Salvar e aplicar
      </Button>
    </form>
  );
}
