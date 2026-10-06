import { claimSpeechWork, getSpeechWorkStatus } from "@/contexts/speech";
import { rejectUnlessCron } from "@/platform/scheduled-jobs/cron-auth";

// Worker de leitura em voz alta (scripts/speech-worker, GitHub Actions). Bearer CRON_SECRET.
//   GET  -> { mode, enabled, pending }: o worker só instala os modelos se houver fila.
//   POST { limit } -> { jobs, limitReached }: reserva textos e a cota do mês deles.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const status = await getSpeechWorkStatus();
  return status.success ? Response.json(status.data) : Response.json({ error: status.error.message }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? body.limit : 10;
  const result = await claimSpeechWork(limit);
  return result.success ? Response.json(result.data) : Response.json({ error: result.error.message }, { status: 500 });
}
