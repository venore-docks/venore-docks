"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  regenerateSpeechAction,
  requestSpeechWorkerRunAction,
  retryFailedSpeechAction,
  type SpeechPanelActionState,
} from "../actions";

const initialState: SpeechPanelActionState = { error: null, notice: null };

// "Gerar agora": chama o worker do GitHub Actions sem esperar o agendamento.
export function RunWorkerButton() {
  const [state, formAction, pending] = useActionState(requestSpeechWorkerRunAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: state.notice ?? "Worker chamado." });
  return (
    <form action={formAction}>
      <Button type="submit" size="sm" disabled={pending}>
        Gerar agora
      </Button>
    </form>
  );
}

// "Tentar de novo": textos com falha de um conteúdo (ou todos, sem scope) voltam para a fila.
export function RetryFailedButton({ scope, label = "Tentar de novo" }: { scope?: string; label?: string }) {
  const [state, formAction, pending] = useActionState(retryFailedSpeechAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: state.notice ?? "Voltou para a fila." });
  return (
    <form action={formAction}>
      {scope && <input type="hidden" name="scope" value={scope} />}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {label}
      </Button>
    </form>
  );
}

// "Gerar de novo": todas as faixas do conteúdo voltam para a fila com a voz atual. O áudio atual
// sai na hora, então pede confirmação.
export function RegenerateButton({ scope }: { scope: string }) {
  const [state, formAction, pending] = useActionState(regenerateSpeechAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: state.notice ?? "Voltou para a fila." });
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Gerar de novo todo o áudio deste conteúdo? O áudio atual sai até o novo ficar pronto.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="scope" value={scope} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Gerar de novo
      </Button>
    </form>
  );
}
