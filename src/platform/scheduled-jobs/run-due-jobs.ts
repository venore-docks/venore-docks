import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { beginOperation, endOperation } from "@/observability";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { CORE_SCHEDULED_JOBS } from "./core-jobs";
import { claimJob, finishJob } from "./store";
import type { ScheduledJob, ScheduledJobReport } from "./types";

// Lock generoso: se a execução morrer no meio (timeout da função), a tarefa volta a ficar
// disponível depois disso em vez de travar pra sempre.
const JOB_LOCK_MS = 10 * 60 * 1000;

async function collectJobs(): Promise<ScheduledJob[]> {
  const active = await getActivePluginKeys();
  const pluginJobs = Object.entries(PLUGIN_CONTRIBUTIONS)
    .filter(([pluginKey]) => active.has(pluginKey))
    .flatMap(([pluginKey, contributions]) =>
      (contributions.scheduledJobs ?? []).map((job) => ({ ...job, key: `${pluginKey}.${job.key}` })),
    );
  return [...CORE_SCHEDULED_JOBS, ...pluginJobs];
}

// Roda as tarefas cujo intervalo já venceu (core + plugins ativos), uma de cada vez, cada uma
// isolada: erro de uma não impede as outras. Chamado pelo endpoint de cron (/api/cron/tick).
export async function runDueJobs(): Promise<ScheduledJobReport[]> {
  const jobs = await collectJobs();
  const reports: ScheduledJobReport[] = [];

  for (const job of jobs) {
    const intervalMs = Math.max(1, job.intervalMinutes) * 60 * 1000;
    // Folga de 5s: o cron bate de minuto em minuto e o relógio varia um pouco entre execuções.
    const claimed = await claimJob(job.key, intervalMs - 5_000, JOB_LOCK_MS);
    if (!claimed) {
      reports.push({ key: job.key, status: "skipped" });
      continue;
    }

    const handle = beginOperation({ useCase: `platform.scheduled-job.${job.key}`, actor: { id: "cron", type: "system" }, kind: "read" });
    try {
      const result = await job.run();
      if (result.success) {
        await finishJob(job.key, "success", null);
        endOperation(handle, { success: true });
        reports.push({ key: job.key, status: "success" });
      } else {
        await finishJob(job.key, "failure", result.error.message);
        endOperation(handle, result);
        reports.push({ key: job.key, status: "failure", error: result.error.message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishJob(job.key, "failure", message);
      endOperation(handle, { success: false, error: { code: "platform.scheduled-job.crashed", message } });
      reports.push({ key: job.key, status: "failure", error: message });
    }
  }

  return reports;
}
