import { readMediaAsset } from "@/contexts/media";
import type { ByteRange } from "@/infrastructure/storage/storage-port";

// Parser de `Range: bytes=a-b` (um único intervalo). O tamanho total só é conhecido depois de
// abrir o objeto, então o sufixo ("últimos N bytes") e o fim aberto são resolvidos em dois passos.
export function parseRangeHeader(header: string | null): { start: number | null; end: number | null } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  return { start: rawStart === "" ? null : Number(rawStart), end: rawEnd === "" ? null : Number(rawEnd) };
}

function resolveRange(parsed: { start: number | null; end: number | null }, size: number): ByteRange | null {
  let { start, end } = parsed;
  if (start === null) {
    start = Math.max(0, size - (end ?? 0));
    end = size - 1;
  } else if (end === null || end >= size) {
    end = size - 1;
  }
  if (start < 0 || start > end || end >= size) return null;
  return { start, end };
}

const CONTENT_POLICY_FOR_MEDIA = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";

// Resposta HTTP de um asset (rota por id ou do driver filesystem). Autorização é do handler de
// media (readMediaAsset); aqui só HTTP: range, cache, e uma CSP `sandbox` que impede qualquer
// script embutido (ex: num SVG) de rodar na origem do site.
export async function serveMediaResponse(
  request: Request,
  lookup: { id?: string; pathname?: string },
): Promise<Response> {
  const url = new URL(request.url);
  const parsedRange = parseRangeHeader(request.headers.get("range"));

  // Primeira leitura sem range quando o pedido depende do tamanho (sufixo/fim aberto).
  const needsSize = parsedRange !== null && (parsedRange.start === null || parsedRange.end === null);
  const exactRange = parsedRange && !needsSize ? { start: parsedRange.start!, end: parsedRange.end! } : null;

  let result = await readMediaAsset({
    ...lookup,
    exp: url.searchParams.get("exp"),
    sig: url.searchParams.get("sig"),
    range: exactRange,
  });
  if (!result.success) {
    return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  if (needsSize && parsedRange) {
    const range = resolveRange(parsedRange, result.data.size);
    await result.data.body.cancel();
    if (!range) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${result.data.size}` } });
    }
    result = await readMediaAsset({ ...lookup, exp: url.searchParams.get("exp"), sig: url.searchParams.get("sig"), range });
    if (!result.success) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const { body, size, contentType, range, visibility } = result.data;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Content-Security-Policy": CONTENT_POLICY_FOR_MEDIA,
    "X-Content-Type-Options": "nosniff",
    // Público: pode ficar em cache compartilhado (a key tem UUID). Não público: nunca em cache
    // compartilhado — a resposta depende de quem pediu.
    "Cache-Control": visibility === "public" ? "public, max-age=3600" : "private, no-store",
  };

  if (range) {
    return new Response(body, {
      status: 206,
      headers: { ...headers, "Content-Length": String(range.end - range.start + 1), "Content-Range": `bytes ${range.start}-${range.end}/${size}` },
    });
  }
  return new Response(body, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
