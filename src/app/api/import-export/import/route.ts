import { NextResponse } from "next/server";
import { importSiteBundle } from "@/contexts/import-export";
import { resolveBlockDefinition } from "@/platform/page-builder/block-registry";

function statusForErrorCode(code: string): number {
  if (code === "rbac.authorization.unauthenticated") return 401;
  if (code === "rbac.authorization.forbidden") return 403;
  if (code === "import-export.too_large") return 413;
  if (code === "import-export.length_required") return 411;
  return 400;
}

function declaredContentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

// Rota própria (não Server Action) pelo mesmo motivo de export/route.ts: o .zip de um pacote de
// import real (fotos, vídeos) passa fácil do limite de body de Server Action (10mb,
// next.config.ts). O corpo só é lido DENTRO do handler, depois da autorização e da checagem do
// Content-Length declarado (IMPORT_MAX_ZIP_BYTES) — nunca antes.
export async function POST(request: Request): Promise<NextResponse> {
  const result = await importSiteBundle({
    declaredSize: declaredContentLength(request),
    readZipData: async () => {
      // Corpo multipart malformado vira "nenhum arquivo" (400), não 500.
      const formData = await request.formData().catch(() => null);
      const file = formData?.get("file");
      return file instanceof File ? Buffer.from(await file.arrayBuffer()) : Buffer.alloc(0);
    },
    resolveDefinition: resolveBlockDefinition,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: statusForErrorCode(result.error.code) });
  }

  return NextResponse.json({ report: result.data });
}
