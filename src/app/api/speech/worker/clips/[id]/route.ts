import { completeSpeechWork } from "@/contexts/speech";
import { rejectUnlessCron } from "@/platform/scheduled-jobs/cron-auth";

// Entrega do MP3 de um texto reservado pelo worker: corpo cru audio/mpeg, header
// X-Speech-Text-Hash com o textHash recebido no claim. 200 { stored } — stored false quando o
// texto mudou no meio (o MP3 é descartado, não é erro).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const { id } = await params;
  const textHash = request.headers.get("x-speech-text-hash") ?? "";
  if (!textHash) return Response.json({ error: "Falta o header X-Speech-Text-Hash." }, { status: 400 });

  const result = await completeSpeechWork({
    id,
    textHash,
    contentType: (request.headers.get("content-type") ?? "").split(";")[0].trim(),
    audio: Buffer.from(await request.arrayBuffer()),
  });
  return result.success ? Response.json(result.data) : Response.json({ error: result.error.message }, { status: 400 });
}
