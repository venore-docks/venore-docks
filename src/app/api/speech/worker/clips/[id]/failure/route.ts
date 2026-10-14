import { failSpeechWork } from "@/contexts/speech";
import { rejectUnlessCron } from "@/platform/scheduled-jobs/cron-auth";

// O worker não conseguiu gerar este texto: { textHash, error }. Devolve a cota reservada e conta
// a tentativa (3 falhas -> "failed"; republicar tenta de novo).
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { textHash?: unknown; error?: unknown };
  if (typeof body.textHash !== "string" || !body.textHash) return Response.json({ error: "Falta textHash." }, { status: 400 });
  const result = await failSpeechWork({ id, textHash: body.textHash, error: String(body.error ?? "erro desconhecido") });
  return result.success ? Response.json(result.data) : Response.json({ error: result.error.message }, { status: 400 });
}
