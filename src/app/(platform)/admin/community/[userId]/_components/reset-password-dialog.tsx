"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { resetUserPasswordAction, type CommunityActionState } from "../../actions";

const initialState: CommunityActionState = { error: null };

export function ResetPasswordDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Senha redefinida.", onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <KeyRound className="size-4" /> Redefinir senha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>Define uma nova senha pra esse usuário. Ele não é avisado — combine com ele por fora.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="targetUserId" value={userId} />
          <div className="space-y-2">
            <label htmlFor="new-password" className="block text-xs font-medium text-muted-foreground">
              Nova senha
            </label>
            <Input id="new-password" name="newPassword" type="password" minLength={8} required />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              Redefinir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
