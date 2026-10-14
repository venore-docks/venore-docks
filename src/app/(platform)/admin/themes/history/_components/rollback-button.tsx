"use client";

import { useActionState, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { rollbackThemeConfigAction, type ConfigActionState } from "../../_actions/config";

const initialState: ConfigActionState = { error: null, warnings: [], done: false };

// Restaurar abre uma confirmação (spec §7.2): o rollback publica uma revisão NOVA com a config
// desta, substituindo o rascunho em andamento — por isso o aviso.
export function RollbackButton({ revisionId, label }: { revisionId: string; label: string }) {
  const [state, formAction, pending] = useActionState(rollbackThemeConfigAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Aparência restaurada e publicada." });
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="revisionId" value={revisionId} />
      </form>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setOpen(true)}>
        Restaurar
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar esta aparência?</AlertDialogTitle>
            <AlertDialogDescription>
              A configuração de {label} será publicada de novo, como uma nova revisão. O rascunho em andamento, se houver, é substituído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                formRef.current?.requestSubmit();
              }}
            >
              Restaurar e publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
