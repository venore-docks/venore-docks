"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateRegistrationApprovalAction, type SettingsActionState } from "../actions";

const initialState: SettingsActionState = { error: null };

export function RegistrationApprovalToggleForm({ enabled, selfRegistration }: { enabled: boolean; selfRegistration: boolean }) {
  const [state, formAction, pending] = useActionState(updateRegistrationApprovalAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Configuração salva." });

  return (
    <form action={formAction} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="selfRegistration"
          defaultChecked={selfRegistration}
          className="size-4 rounded-sm border-border outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
        Permitir que visitantes criem conta (formulário &quot;Criar conta&quot; e primeiro login social)
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="size-4 rounded-sm border-border outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
        Exigir aprovação manual para novos registros
      </label>

      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
