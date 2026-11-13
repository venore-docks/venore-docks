"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { useActionToast } from "@/hooks/use-action-toast";
import { deleteMediaAction, getMediaUsageSummaryAction, type MediaActionState } from "../actions";

const initialState: MediaActionState = { error: null };

// Aviso + confirmação (docs do pedido: "a deleção avisa quantos locais serão afetados e exige
// confirmação", depois trocado de window.confirm nativo para um AlertDialog do próprio site):
// o clique no botão abre o diálogo já com um texto provisório e dispara a busca do resumo de uso
// em paralelo (useTransition) — o texto é atualizado assim que a resposta chega, sem bloquear a
// abertura do diálogo. Só ao clicar em "Excluir" dentro do diálogo o form (fora do AlertDialog,
// sempre com confirmed="true") é submetido de verdade via formRef — deleteMediaSafely ainda é
// quem decide o que fazer com isso no servidor.
export function DeleteMediaButton({
  id,
  className,
  size = "sm",
  label = "Excluir",
  ariaLabel,
  redirectTo,
}: {
  id: string;
  className?: string;
  size?: "sm" | "icon";
  label?: React.ReactNode;
  ariaLabel?: string;
  // Página de detalhe passa "/admin/media": o asset excluído deixa de existir, não faz sentido
  // continuar nela. A grade não passa nada — revalidatePath já tira o item da lista no lugar.
  redirectTo?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteMediaAction, initialState);
  useActionToast({
    pending,
    error: state.error,
    successMessage: "Arquivo excluído.",
    onSuccess: redirectTo ? () => router.push(redirectTo) : undefined,
  });

  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("Excluir este arquivo?");
  const [loadingUsage, startLoadingUsage] = useTransition();

  function handleTriggerClick() {
    setMessage("Verificando onde este arquivo é usado…");
    setOpen(true);
    startLoadingUsage(async () => {
      const usage = await getMediaUsageSummaryAction(id);
      setMessage(
        usage.length > 0
          ? `Este arquivo está em uso em ${usage.length} ${usage.length === 1 ? "local" : "locais"}: ${usage
              .map((reference) => reference.label)
              .join(", ")}. Excluir mesmo assim?`
          : "Excluir este arquivo?",
      );
    });
  }

  function handleConfirm() {
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="confirmed" value="true" />
      </form>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={pending}
        className={className ?? "text-destructive"}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
      >
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo</AlertDialogTitle>
            <AlertDialogDescription>{message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={loadingUsage} onClick={handleConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
