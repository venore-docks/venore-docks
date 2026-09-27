import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueJobs } from "@/platform/scheduled-jobs/run-due-jobs";

// Batida do agendador (platform/scheduled-jobs). Chamada a cada minuto por:
//   - Vercel Cron (vercel.json -> crons; a Vercel manda "Authorization: Bearer <CRON_SECRET>"
//     sozinha quando CRON_SECRET está definida no projeto), ou
//   - qualquer cron externo (GitHub Actions schedule, cron do servidor) com o mesmo header.
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
