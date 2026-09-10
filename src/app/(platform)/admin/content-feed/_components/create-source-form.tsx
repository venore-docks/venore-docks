"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { createSourceAction, type ContentFeedActionState } from "../actions";

const initialState: ContentFeedActionState = { error: null };

export function CreateSourceForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createSourceAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Fonte cadastrada.", onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Nova fonte
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova fonte</DialogTitle>
          <DialogDescription>
            Aponta pra outra instância venore-docks e pra chave de conexão que ela te deu. Este site vai buscar o
            conteúdo dela quando você sincronizar.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Nome</label>
            <Input name="name" required className="mt-1" placeholder="ex: Portal do Colaborador" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Endereço da outra instância</label>
            <Input name="remoteUrl" required type="url" className="mt-1" placeholder="https://portal.erasto.com.br" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Chave de conexão recebida</label>
            <Input name="connectionKey" required className="mt-1" placeholder="Cole aqui a chave gerada na outra instância" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Categorias desejadas</label>
            <Input name="categoryKeys" className="mt-1" placeholder="ex: noticias, eventos (separadas por vírgula)" />
            <p className="mt-1 text-xs text-muted-foreground">
              Use as mesmas chaves de categoria cadastradas na outra instância. Deixe em branco pra trazer todas as
              categorias liberadas pra essa conexão.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              Cadastrar fonte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
