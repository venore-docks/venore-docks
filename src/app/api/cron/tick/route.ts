import { NextResponse } from "next/server";
import { rejectUnlessCron } from "@/platform/scheduled-jobs/cron-auth";
import { runDueJobs } from "@/platform/scheduled-jobs/run-due-jobs";

// Batida do agendador (platform/scheduled-jobs). Quem chama, com "Authorization: Bearer <CRON_SECRET>":
//   - GitHub Actions (.github/workflows/cron.yml, a cada 5 min) — o caminho padrão, porque o
//     plano Hobby da Vercel só permite cron diário;
//   - Vercel Cron (vercel.json -> crons, plano Pro — a Vercel manda o header sozinha quando
//     CRON_SECRET está definida no projeto; este repositório não traz vercel.json);
//   - ou qualquer cron externo (cron do servidor, cron-job.org).
// Sem CRON_SECRET configurada o endpoint fica desligado (503) — nunca aberto.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;

  const reports = await runDueJobs();
  return NextResponse.json({ ran: reports.filter((report) => report.status !== "skipped"), total: reports.length });
}

export const GET = handle;
export const POST = handle;
