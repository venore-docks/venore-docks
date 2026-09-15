"use client";

import { useActionState, useState } from "react";
import { Skull } from "lucide-react";
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
import { useActionToast } from "@/hooks/use-action-toast";
import { purgeUserAction, type CommunityActionState } from "../actions";

const initialState: CommunityActionState = { error: null };

// Só superadmin chega aqui (checado por quem renderiza este componente, não aqui — mesmo padrão
// de RemoveUserDialog). Sem campo de motivo: a conta já passou pelo remove-user com o motivo dela;
// isto é só o hard delete final, sem lixeira nem desfazer (mesmo tom de DeleteEntryDialog).
export function PurgeUserDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(purgeUserAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Conta apagada definitivamente.", onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-destructive">
          <Skull className="size-3" /> Apagar definitivamente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apagar conta definitivamente?</DialogTitle>
          <DialogDescription>
            A linha do usuário é apagada de vez — não existe lixeira nem desfazer. Só funciona se a conta não tiver
            nenhuma entrada de CMS nem arquivo de mídia associado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <input type="hidden" name="targetUserId" value={userId} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              Apagar definitivamente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
