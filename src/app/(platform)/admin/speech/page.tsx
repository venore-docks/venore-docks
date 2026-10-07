import Link from "next/link";
import { SpeechProgress } from "@/components/speech/speech-progress";
import { SpeechWorkerStatus, timeAgo } from "@/components/speech/speech-worker-status";
import { getSpeechStatus, getSpeechWorkerInfo, listSpeechQueue, speechVoices } from "@/contexts/speech";
import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { RegenerateButton, RetryFailedButton, RunWorkerButton } from "./_components/speech-panel-buttons";
import { SpeechSettingsForm } from "./_components/speech-settings-form";

const number = (value: number) => value.toLocaleString("pt-BR");

const RUN_STATUS: Record<string, string> = {
  queued: "na fila do GitHub",
  pending: "na fila do GitHub",
  waiting: "na fila do GitHub",
  requested: "na fila do GitHub",
  in_progress: "rodando",
};
const RUN_CONCLUSION: Record<string, string> = {
  success: "terminou bem",
  failure: "falhou",
  cancelled: "cancelada",
  timed_out: "estourou o tempo",
  skipped: "pulada",
};

// Leitura em voz alta (docs/speech/leitura-em-voz-alta.md): fila e produção de cada conteúdo, o
// worker que gera e a configuração. settings.manage pelo loader de seção (getSettingsPageData);
// as actions autorizam de novo.
export default async function SpeechAdminPage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar a leitura em voz alta.</p>
      </div>
    );
  }

  const [status, queue, worker] = await Promise.all([getSpeechStatus(), listSpeechQueue(), getSpeechWorkerInfo()]);
  if (!status.success || !queue.success || !worker.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar a leitura em voz alta agora. Tente recarregar a página.</p>;
  }

  const { mode, configured, enabled, voice, monthlyCharacterLimit, month, usedCharacters, clips } = status.data;
  const { items, truncated } = queue.data;
  const { canDispatch, actionsUrl, latestRun, lastSynthesizedAt, activity } = worker.data;
  const queued = clips.pending + clips.processing;
  const totals = {
    total: clips.ready + clips.pending + clips.processing + clips.failed,
    ready: clips.ready,
    pending: clips.pending,
    processing: clips.processing,
    failed: clips.failed,
    currentPercent: items.find((item) => item.processing > 0)?.currentPercent ?? null,
    lastError: null,
  };
  const provider =
    mode === "worker"
      ? "pelo worker gratuito do GitHub Actions (modelos abertos Kokoro e Piper)"
      : "pelo Google Cloud Text-to-Speech (vozes Chirp 3 HD)";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Áudios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leitura em voz alta: o áudio de cada texto marcado com &quot;Gerar áudio&quot; é gerado uma vez{" "}
          {configured ? provider : "pelo provedor configurado"} e guardado na biblioteca de mídia. Ouvir não gera de novo.
        </p>
      </div>

      {!configured && (
        <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning">
          Nenhum provedor configurado: defina a variável de ambiente SPEECH_DRIVER=worker (grátis, precisa de CRON_SECRET) ou a
          chave do Google. Veja docs/speech/leitura-em-voz-alta.md.
        </p>
      )}

      <section className="space-y-4 rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Produção</h2>
            <SpeechWorkerStatus activity={activity} queued={queued} />
            {mode === "worker" && latestRun && (
              <p className="text-xs text-muted-foreground">
                Execução mais recente no GitHub:{" "}
                {latestRun.status === "completed"
                  ? (RUN_CONCLUSION[latestRun.conclusion ?? ""] ?? latestRun.conclusion ?? "terminada")
                  : (RUN_STATUS[latestRun.status] ?? latestRun.status)}{" "}
                ({timeAgo(latestRun.startedAt)}) ·{" "}
                <a href={latestRun.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                  ver o log
                </a>
              </p>
            )}
            {lastSynthesizedAt && <p className="text-xs text-muted-foreground">Último áudio pronto {timeAgo(lastSynthesizedAt)}.</p>}
          </div>
          {mode === "worker" && (
            <div className="flex flex-wrap items-center gap-2">
              {canDispatch && <RunWorkerButton />}
              <a
                href={actionsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Execuções no GitHub
              </a>
            </div>
          )}
        </div>

        {mode === "worker" && !canDispatch && (
          <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning">
            Sem SPEECH_WORKER_GITHUB_TOKEN, o worker só roda pelo agendamento do GitHub, que pode atrasar horas. Com o token, ele é
            chamado assim que algo entra na fila e aparece o botão &quot;Gerar agora&quot;.
          </p>
        )}

        <SpeechProgress progress={totals} />

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Usado em {month}</dt>
            <dd className="font-medium text-foreground">
              {number(usedCharacters)} de {number(monthlyCharacterLimit)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prontas</dt>
            <dd className="font-medium text-foreground">{number(clips.ready)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Na fila</dt>
            <dd className="font-medium text-foreground">{number(queued)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Com falha</dt>
            <dd className="font-medium text-foreground">{number(clips.failed)}</dd>
          </div>
        </dl>
        {clips.failed > 1 && <RetryFailedButton label="Tentar de novo todas as falhas" />}
      </section>

      <section className="space-y-3 rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Onde há áudio</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum conteúdo com áudio ainda. Marque &quot;Gerar áudio&quot; na edição de um conteúdo do Editorial ou de uma obra.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.scope} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 sm:w-64 sm:shrink-0">
                  {item.href ? (
                    <Link href={item.href} className="block truncate text-sm font-medium text-foreground hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                  )}
                  <span className="block truncate text-xs text-muted-foreground/56">
                    {item.scope} · {number(item.characters)} caracteres
                    {item.updatedAt && ` · ${timeAgo(item.updatedAt)}`}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <SpeechProgress progress={item} autoRefresh={false} compact />
                  {item.failed > 0 && item.lastError && <p className="mt-1 truncate text-xs text-destructive">{item.lastError}</p>}
                </div>
                {item.failed > 0 && <RetryFailedButton scope={item.scope} />}
                {item.pending + item.processing === 0 && item.ready > 0 && <RegenerateButton scope={item.scope} />}
              </li>
            ))}
          </ul>
        )}
        {truncated && <p className="text-xs text-muted-foreground">Mostrando os 200 mais recentes.</p>}
      </section>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Configuração</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Só texto novo ou alterado entra na fila. Ao chegar no teto do mês, a geração para e volta no mês seguinte. Trocar a voz
          vale para o que for publicado ou alterado depois.
        </p>
        <div className="mt-4">
          <SpeechSettingsForm
            enabled={enabled}
            voice={voice}
            monthlyCharacterLimit={monthlyCharacterLimit}
            voices={speechVoices().map(({ key, label }) => ({ key, label }))}
          />
        </div>
      </section>
    </div>
  );
}
