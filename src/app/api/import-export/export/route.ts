import { NextResponse } from "next/server";
import { exportSiteBundle, toExportZip } from "@/contexts/import-export";

function statusForErrorCode(code: string): number {
  if (code === "rbac.authorization.unauthenticated") return 401;
  if (code === "rbac.authorization.forbidden") return 403;
  return 400;
}

// Download binário não cabe no contrato de Server Action (retorno serializável) — mesmo motivo
// de upload grande usar rota própria em vez de action (app/api/media/upload/route.ts). O gate de
// permissão de verdade acontece dentro de exportSiteBundle (handler), não aqui — esta rota só
// converte o resultado em resposta HTTP.
export async function GET(): Promise<NextResponse> {
  const result = await exportSiteBundle();

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: statusForErrorCode(result.error.code) });
  }

  const zip = toExportZip(result.data);
  const filename = `venore-export-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.byteLength),
      // Quantos arquivos de mídia ficaram de fora (motivos em manifest.skippedAssets).
      "X-Export-Skipped-Assets": String(result.data.manifest.skippedAssets?.length ?? 0),
    },
  });
}
