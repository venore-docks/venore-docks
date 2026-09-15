"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rejectUserAction } from "../actions";
import { ReasonConfirmDialog } from "./reason-confirm-dialog";

export function RejectUserDialog({ userId }: { userId: string }) {
  return (
    <ReasonConfirmDialog
      trigger={
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-destructive">
          <X className="size-3" /> Rejeitar
        </Button>
      }
      title="Rejeitar cadastro?"
      description="O cadastro fica marcado como rejeitado e o usuário não consegue mais entrar."
      confirmLabel="Rejeitar cadastro"
      hiddenFields={{ userId }}
      action={rejectUserAction}
      successMessage="Cadastro rejeitado."
    />
  );
}
