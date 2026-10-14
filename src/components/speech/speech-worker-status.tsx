import type { SpeechWorkerActivity } from "@/contexts/speech";

// Há quanto tempo, em texto curto ("agora", "há 3 min", "há 2 h"). Calculado no servidor, na hora
// do render — a página se atualiza sozinha enquanto há fila (SpeechProgress).
export function timeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `há ${hours} h` : `há ${Math.round(hours / 24)} dias`;
}

// O que o worker de áudio está fazendo agora, pelo sinal de vida que ele manda (contexts/speech).
// `queued` = textos esperando: sem sinal e com fila, avisa que a fila está parada.
export function SpeechWorkerStatus({ activity, queued }: { activity: SpeechWorkerActivity; queued: number }) {
  if (activity.mode !== "worker") return null;
  const since = timeAgo(activity.since);
  const last = timeAgo(activity.lastSignalAt);

  const state =
    activity.stage === "generating"
      ? { busy: true, text: `Worker gerando áudio agora (começou ${since}).` }
      : activity.stage === "preparing"
        ? { busy: true, text: `Worker preparando as vozes (${since}): a geração começa em alguns minutos.` }
        : queued > 0
          ? {
              busy: false,
              text:
                activity.stage === "silent"
                  ? `Worker parou de responder (último sinal ${last}). A fila espera a próxima execução.`
                  : `Fila esperando o worker${last ? ` (última execução ${last})` : ""}.`,
            }
          : { busy: false, text: last ? `Worker parado: nada na fila (última execução ${last}).` : "Worker parado: nada na fila." };

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span
        aria-hidden
        className={state.busy ? "size-2 shrink-0 animate-pulse rounded-full bg-primary" : "size-2 shrink-0 rounded-full bg-muted-foreground/56"}
      />
      {state.text}
    </p>
  );
}
