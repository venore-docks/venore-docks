// Disparo e acompanhamento do worker de leitura em voz alta (.github/workflows/speech-worker.yml)
// pela API do GitHub. O `schedule` do GitHub Actions atrasa horas em repositório com pouca
// atividade; com um token, o app pede uma execução assim que algo entra na fila e o painel mostra
// a execução mais recente. Sem token, só o agendamento do workflow vale.
//
// SPEECH_WORKER_GITHUB_TOKEN: token fine-grained com "Actions: read and write" no repositório do
// workflow. SPEECH_WORKER_GITHUB_REPO (padrão venore-docks/venore-docks) e SPEECH_WORKER_GITHUB_REF
// (padrão main) só mudam para fork.

const WORKFLOW_FILE = "speech-worker.yml";
const DEFAULT_REPO = "venore-docks/venore-docks";
const TIMEOUT_MS = 8_000;

export type SpeechWorkerRun = {
  status: "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending";
  // Só em "completed": success, failure, cancelled...
  conclusion: string | null;
  event: string;
  startedAt: string;
  updatedAt: string;
  url: string;
};

export interface SpeechWorkerTrigger {
  isConfigured(): boolean;
  // Página do workflow no GitHub (funciona sem token, para quem tem acesso ao repositório).
  readonly actionsUrl: string;
  dispatch(): Promise<{ ok: boolean; error?: string }>;
  latestRun(): Promise<SpeechWorkerRun | null>;
}

type RunPayload = {
  status: SpeechWorkerRun["status"];
  conclusion: string | null;
  event: string;
  run_started_at?: string;
  created_at: string;
  updated_at: string;
  html_url: string;
};

export function createSpeechWorkerTrigger(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): SpeechWorkerTrigger {
  const token = env.SPEECH_WORKER_GITHUB_TOKEN?.trim() ?? "";
  const repo = env.SPEECH_WORKER_GITHUB_REPO?.trim() || DEFAULT_REPO;
  const ref = env.SPEECH_WORKER_GITHUB_REF?.trim() || "main";
  const api = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  return {
    actionsUrl: `https://github.com/${repo}/actions/workflows/${WORKFLOW_FILE}`,
    isConfigured: () => token.length > 0,

    async dispatch() {
      if (!token) return { ok: false, error: "SPEECH_WORKER_GITHUB_TOKEN não configurado." };
      try {
        const response = await fetchImpl(`${api}/dispatches`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ ref }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.status === 204) return { ok: true };
        return { ok: false, error: `GitHub respondeu HTTP ${response.status} ao pedir a execução do worker.` };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    async latestRun() {
      if (!token) return null;
      try {
        const response = await fetchImpl(`${api}/runs?per_page=1&exclude_pull_requests=true`, {
          headers,
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        if (!response.ok) return null;
        const body = (await response.json()) as { workflow_runs?: RunPayload[] };
        const run = body.workflow_runs?.[0];
        if (!run) return null;
        return {
          status: run.status,
          conclusion: run.conclusion,
          event: run.event,
          startedAt: run.run_started_at ?? run.created_at,
          updatedAt: run.updated_at,
          url: run.html_url,
        };
      } catch {
        return null;
      }
    },
  };
}

export const speechWorkerTrigger: SpeechWorkerTrigger = createSpeechWorkerTrigger();
