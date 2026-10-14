import { recordSpeechWorkerStage } from "@/contexts/speech";
import { rejectUnlessCron } from "@/platform/scheduled-jobs/cron-auth";

// Sinal de vida do worker: { stage: "preparing" | "generating" | "finished", detail? }. O painel
// /admin/speech mostra a fase e há quanto tempo.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const body = (await request.json().catch(() => ({}))) as { stage?: unknown; detail?: unknown };
  const result = await recordSpeechWorkerStage({
    stage: String(body.stage ?? ""),
    detail: typeof body.detail === "string" ? body.detail : null,
  });
  return result.success ? Response.json(result.data) : Response.json({ error: result.error.message }, { status: 400 });
}
