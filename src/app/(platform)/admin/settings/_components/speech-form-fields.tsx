"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateSpeechSettingsAction, type SpeechSettingsActionState } from "../_actions/speech";

const initialState: SpeechSettingsActionState = { error: null };

export function SpeechFormFields({
  enabled,
  voice,
  monthlyCharacterLimit,
  voices,
}: {
  enabled: boolean;
  voice: string;
  monthlyCharacterLimit: number;
  voices: { key: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateSpeechSettingsAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Leitura em voz alta salva." });

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 sm:items-end">
      <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="size-4 rounded-sm border-border outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
        Gerar áudio dos textos publicados e mostrar o botão de ouvir
      </label>
      <label className="block space-y-1 text-sm text-muted-foreground">
        <span>Voz</span>
        <select
          name="voice"
          defaultValue={voice}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {voices.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm text-muted-foreground">
        <span>Teto de caracteres por mês</span>
        <Input name="monthlyCharacterLimit" defaultValue={String(monthlyCharacterLimit)} inputMode="numeric" required />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
