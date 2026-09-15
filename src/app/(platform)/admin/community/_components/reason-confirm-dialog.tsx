"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import type { CommunityActionState } from "../actions";

// Compartilhado por rejeitar/congelar/remover — as três são "ação privilegiada sobre outra conta,
// com motivo opcional que vai pro detail da auditoria" (ver reason em freeze-user/remove-user
// service.ts e rbac/reject-registration). Um Dialog de confirmação só, parametrizado, em vez de
// três quase-cópias (mesmo racional de reaproveitar em vez de duplicar o DeleteEntryDialog).
export function ReasonConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  hiddenFields,
  action,
  successMessage,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  hiddenFields: Record<string, string>;
  action: (prevState: CommunityActionState, formData: FormData) => Promise<CommunityActionState>;
  successMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, { error: null } as CommunityActionState);
  useActionToast({ pending, error: state.error, successMessage, onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="space-y-2">
            <label htmlFor="reason" className="block text-xs font-medium text-muted-foreground">
              Motivo (opcional, fica registrado na auditoria)
            </label>
            <Textarea id="reason" name="reason" rows={3} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
