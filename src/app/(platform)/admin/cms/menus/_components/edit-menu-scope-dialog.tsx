"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
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
import { updateMenuScopeAction, type MenuActionState } from "../actions";

const initialState: MenuActionState = { error: null };

// Só para menu contextual: troca o prefixo de rota em que ele aparece. O service normaliza o valor
// (minúsculas, sem barra final) e recusa um escopo que outro menu já usa.
export function EditMenuScopeDialog({ menuId, menuName, scopePath }: { menuId: string; menuName: string; scopePath: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateMenuScopeAction, initialState);

  useActionToast({
    pending,
    error: state.error,
    successMessage: "Escopo atualizado.",
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Editar escopo de ${menuName}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar escopo</DialogTitle>
          <DialogDescription>O menu “{menuName}” aparece em qualquer rota que comece com este prefixo.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="menuId" value={menuId} />
          <div>
            <label htmlFor={`scope-${menuId}`} className="block text-xs font-medium text-muted-foreground">
              Prefixo de rota (scopePath)
            </label>
            <Input id={`scope-${menuId}`} name="scopePath" required defaultValue={scopePath} className="mt-1" placeholder="ex: /academy" />
            <p className="mt-1 text-xs text-muted-foreground/56">A correspondência mais longa vence quando dois menus casam a mesma rota.</p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
