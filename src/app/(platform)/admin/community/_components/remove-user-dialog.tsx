"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeUserAction } from "../actions";
import { ReasonConfirmDialog } from "./reason-confirm-dialog";

// Só aparece pra quem tem rbac.users.remove (checado pela página, não aqui — mesmo padrão de
// EntriesTable só renderizar DeleteEntryDialog quando o status permite).
export function RemoveUserDialog({ userId }: { userId: string }) {
  return (
    <ReasonConfirmDialog
      trigger={
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-destructive">
          <Trash2 className="size-3" /> Remover
        </Button>
      }
      title="Remover conta?"
      description="O email, nome e senha são apagados e a conta para de aceitar login. Não é reversível pela UI — conteúdo já publicado pelo usuário continua existindo."
      confirmLabel="Remover conta"
      hiddenFields={{ targetUserId: userId }}
      action={removeUserAction}
      successMessage="Conta removida."
    />
  );
}
