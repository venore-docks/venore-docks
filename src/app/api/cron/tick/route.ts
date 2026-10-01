import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
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

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, received);
}

async function handle(request: Request): Promise<NextResponse> {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET não configurada." }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const reports = await runDueJobs();
  return NextResponse.json({ ran: reports.filter((report) => report.status !== "skipped"), total: reports.length });
}

export const GET = handle;
export const POST = handle;
