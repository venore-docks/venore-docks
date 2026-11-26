"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { revokeOtherSessionsAction, type AccountActionState } from "../actions";

const initialState: AccountActionState = { error: null };

export function RevokeSessionsForm() {
  const [state, formAction, pending] = useActionState(revokeOtherSessionsAction, initialState);
  useActionToast({ pending, error: state.error });

  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Desconecta esta conta de todos os outros navegadores e dispositivos. Esta sessão continua ativa.
      </p>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Encerrando..." : "Sair dos outros dispositivos"}
      </Button>
    </form>
  );
}
