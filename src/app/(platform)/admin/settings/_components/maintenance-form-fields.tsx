"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateMaintenanceAction, type MaintenanceActionState } from "../_actions/maintenance";

const initialState: MaintenanceActionState = { error: null };

// Mesmo limite de MAINTENANCE_MESSAGE_MAX_LENGTH (resolve-maintenance.ts), repetido para não
// puxar módulo de servidor para o client.
const MESSAGE_MAX_LENGTH = 500;

export function MaintenanceFormFields({ enabled, message }: { enabled: boolean; message: string }) {
  const [state, formAction, pending] = useActionState(updateMaintenanceAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Modo manutenção salvo." });

  return (
    <form action={formAction} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="size-4 rounded-sm border-border outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
        Colocar o site em manutenção
      </label>
      <label className="block space-y-1 text-sm text-muted-foreground">
        <span>Mensagem para os visitantes (opcional)</span>
        <Textarea name="message" defaultValue={message} maxLength={MESSAGE_MAX_LENGTH} rows={3} placeholder="O site volta em instantes." />
      </label>
      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
