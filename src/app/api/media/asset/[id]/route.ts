import { serveMediaResponse } from "@/platform/media-serving/serve-media";

// Serve um asset de mídia por id, com autorização por asset (público, dono, media.manage ou URL
// assinada). É a URL de todo asset não público (contexts/media/asset-url.ts).
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return serveMediaResponse(request, { id });
}
