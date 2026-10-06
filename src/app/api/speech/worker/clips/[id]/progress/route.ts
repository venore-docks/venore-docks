import { reportSpeechWorkProgress } from "@/contexts/speech";
import { rejectUnlessCron } from "@/platform/scheduled-jobs/cron-auth";

// Andamento da síntese deste texto: { textHash, percent }. Responde { active: false } quando o
// texto mudou ou a reserva venceu — o worker pode parar.
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { textHash?: unknown; percent?: unknown };
  if (typeof body.textHash !== "string" || !body.textHash) return Response.json({ error: "Falta textHash." }, { status: 400 });
  const result = await reportSpeechWorkProgress({ id, textHash: body.textHash, percent: Number(body.percent) });
  return result.success ? Response.json(result.data) : Response.json({ error: result.error.message }, { status: 400 });
}
