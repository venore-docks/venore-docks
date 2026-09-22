"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { deleteContentTypeAction, type CmsActionState } from "../actions";

const initialState: CmsActionState = { error: null };
const NO_REASSIGNMENT = "__none__";

// Exclusão sem reatribuição só é aceita pelo service (delete-content-type) quando nenhum
// conteúdo ficaria sem nenhuma tag — regra de negócio fixa (create-entry/update-entry já exigem
// pelo menos 1 na escrita). O <Select> de reatribuição é opcional: sem escolher nada, o erro do
// service (would_orphan_entries) chega via toast e o editor volta aqui pra escolher uma tag.
export function DeleteContentTypeDialog({
  contentType,
  otherContentTypes,
}: {
  contentType: { id: string; name: string; entryCount: number };
  otherContentTypes: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [reassignToId, setReassignToId] = useState(NO_REASSIGNMENT);
  const [state, formAction, pending] = useActionState(deleteContentTypeAction, initialState);

  useActionToast({
    pending,
    error: state.error,
    successMessage: "Tag excluída.",
    onSuccess: () => {
      setOpen(false);
      setReassignToId(NO_REASSIGNMENT);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-destructive">
          <Trash2 className="size-3" /> Excluir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir tag &ldquo;{contentType.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            {contentType.entryCount > 0
              ? `${contentType.entryCount} conteúdo(s) usam esta tag. Você pode reatribuí-los a outra tag agora, ou deixar em branco — a exclusão só é bloqueada se algum conteúdo ficasse sem nenhuma tag.`
              : "Nenhum conteúdo usa esta tag hoje."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={contentType.id} />
          <input type="hidden" name="reassignToId" value={reassignToId === NO_REASSIGNMENT ? "" : reassignToId} />

          {otherContentTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Reatribuir conteúdos para (opcional)
              </label>
              <Select value={reassignToId} onValueChange={setReassignToId}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REASSIGNMENT}>Não reatribuir</SelectItem>
                  {otherContentTypes.map((other) => (
                    <SelectItem key={other.id} value={other.id}>
                      {other.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              Excluir tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
