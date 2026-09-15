"use client";

import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { freezeUserAction } from "../actions";
import { ReasonConfirmDialog } from "./reason-confirm-dialog";

export function FreezeUserDialog({ userId }: { userId: string }) {
  return (
    <ReasonConfirmDialog
      trigger={
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-destructive">
          <Snowflake className="size-3" /> Congelar
        </Button>
      }
      title="Congelar conta?"
      description="O usuário é desconectado e não consegue mais entrar até alguém reativar a conta."
      confirmLabel="Congelar conta"
      hiddenFields={{ targetUserId: userId }}
      action={freezeUserAction}
      successMessage="Conta congelada."
    />
  );
}
