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
import { createConnectionAction, type ContentFeedActionState } from "../actions";
import { CategoryCheckboxPicker } from "./category-checkbox-picker";

const initialState: ContentFeedActionState = { error: null };

export function CreateConnectionForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createConnectionAction, initialState);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useActionToast({
    pending,
    error: state.error,
    successMessage: "Conexão criada.",
    onSuccess: () => {
      setOpen(false);
      setCategoryIds([]);
    },
  });

  function toggleCategory(id: string) {
    setCategoryIds((current) => (current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Nova conexão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conexão</DialogTitle>
          <DialogDescription>
            Gera uma chave que outra instância venore-docks usa pra buscar o conteúdo publicado aqui, nas categorias
            escolhidas.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Nome</label>
            <Input name="name" required className="mt-1" placeholder="ex: Broadcast — Recepção FEM" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Categorias liberadas</label>
            <CategoryCheckboxPicker categories={categories} selected={categoryIds} onToggle={toggleCategory} />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              Criar conexão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
