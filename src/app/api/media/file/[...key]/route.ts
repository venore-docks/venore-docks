import { NextResponse } from "next/server";
import { serveMediaResponse } from "@/platform/media-serving/serve-media";

// Serve um objeto do driver de storage "filesystem" (MEDIA_STORAGE_DRIVER=filesystem) pela key.
// Só arquivos que são assets de mídia registrados, e com a mesma autorização por asset da rota por
// id — antes qualquer key sob a raiz era servida sem sessão, inclusive arquivo "private".
// Streaming com range (o arquivo não é mais lido inteiro pra memória).
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  if ((process.env.MEDIA_STORAGE_DRIVER ?? "local") !== "filesystem") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { key: segments } = await params;
  const pathname = (segments ?? []).map((segment) => decodeURIComponent(segment)).join("/");
  if (pathname.length === 0 || pathname.split("/").includes("..")) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }
  return serveMediaResponse(request, { pathname });
}
