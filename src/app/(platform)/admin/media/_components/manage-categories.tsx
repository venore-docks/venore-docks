"use client";

import { useActionState } from "react";
import { Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  clearCategoryAssetsAction,
  createCategoryAction,
  deleteCategoryAction,
  renameCategoryAction,
  type MediaActionState,
} from "../actions";

const initialState: MediaActionState = { error: null };

function AddCategoryForm() {
  const [state, formAction, pending] = useActionState(createCategoryAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Categoria criada." });

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="text"
        name="name"
        placeholder="Nome da nova categoria"
        required
        aria-label="Nome da nova categoria"
        className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none ui-motion-base placeholder:text-muted-foreground/56 focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" disabled={pending}>
        Adicionar
      </Button>
    </form>
  );
}

// Categoria em uso não apaga (docs do pedido: "não é apagada sem tratar os assets vinculados") —
// o erro devolvido tem essa mensagem com a contagem; a resposta é o botão "Remover categoria de N
// arquivos" (clearCategoryAssetsAction), um passo deliberado antes de deixar tentar apagar de
// novo, nunca uma cascata automática.
function CategoryRow({ id, name, count }: { id: string; name: string; count: number }) {
  const [renameState, renameAction, renamePending] = useActionState(renameCategoryAction, initialState);
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteCategoryAction, initialState);
  const [clearState, clearFormAction, clearPending] = useActionState(clearCategoryAssetsAction, initialState);

  useActionToast({ pending: renamePending, error: renameState.error, successMessage: "Categoria renomeada." });
  useActionToast({ pending: deletePending, error: deleteState.error, successMessage: "Categoria excluída." });
  useActionToast({ pending: clearPending, error: clearState.error, successMessage: "Categoria removida dos arquivos." });

  const blockedByUse = deleteState.error?.includes("em uso") ?? false;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
      <form action={renameAction} className="flex min-w-0 flex-1 items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          type="text"
          name="name"
          defaultValue={name}
          aria-label={`Nome da categoria ${name}`}
          className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm text-foreground outline-none ui-motion-base hover:border-border focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground/56">
          {count} {count === 1 ? "arquivo" : "arquivos"}
        </span>
        <Button type="submit" variant="ghost" size="sm" disabled={renamePending}>
          Salvar
        </Button>
      </form>

      {blockedByUse && (
        <form action={clearFormAction}>
          <input type="hidden" name="categoryId" value={id} />
          <Button type="submit" variant="outline" size="sm" disabled={clearPending}>
            Remover categoria dos arquivos
          </Button>
        </form>
      )}

      <form action={deleteFormAction}>
        <input type="hidden" name="id" value={id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          disabled={deletePending}
          aria-label={`Excluir categoria ${name}`}
          className="text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export function ManageCategories({
  categories,
  countByCategory,
}: {
  categories: { id: string; name: string }[];
  countByCategory: Record<string, number>;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          <Settings2 className="size-4" strokeWidth={2} />
          Gerenciar categorias
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categorias</DialogTitle>
          <DialogDescription>Organize a biblioteca em categorias. Um arquivo pertence a no máximo uma categoria.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {categories.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria criada ainda.</p>}
          {categories.map((category) => (
            <CategoryRow key={category.id} id={category.id} name={category.name} count={countByCategory[category.id] ?? 0} />
          ))}
        </div>

        <AddCategoryForm />
      </DialogContent>
    </Dialog>
  );
}
