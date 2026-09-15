"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
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
import { addUserAction, type CommunityActionState } from "../actions";

const initialState: CommunityActionState = { error: null };

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addUserAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Usuário criado.", onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <UserPlus className="size-4" /> Adicionar usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar usuário</DialogTitle>
          <DialogDescription>
            A conta nasce já aprovada, com o papel padrão de registro. Ele pode trocar a senha depois pelo próprio perfil.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="add-user-name" className="block text-xs font-medium text-muted-foreground">
              Nome
            </label>
            <Input id="add-user-name" name="name" required />
          </div>
          <div className="space-y-2">
            <label htmlFor="add-user-email" className="block text-xs font-medium text-muted-foreground">
              Email
            </label>
            <Input id="add-user-email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <label htmlFor="add-user-password" className="block text-xs font-medium text-muted-foreground">
              Senha
            </label>
            <Input id="add-user-password" name="password" type="password" minLength={8} required />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
