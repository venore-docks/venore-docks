import { NextResponse } from "next/server";
import { exportPublishedThemeConfig } from "@/platform/theme-engine/theme-config";

// Exporta a config de aparência publicada (spec §7.10). Rota de core (não nomeada por plugin): um
// download de arquivo não cabe no retorno de Server Action. O gate (settings.manage) e a
// auditoria (themes.config.export) acontecem no handler do context, via composer de platform.
export const dynamic = "force-dynamic";

function statusForErrorCode(code: string): number {
  if (code === "rbac.authorization.unauthenticated") return 401;
  if (code.startsWith("rbac.authorization.")) return 403;
  return 500;
}

export async function GET(): Promise<NextResponse> {
  const result = await exportPublishedThemeConfig();
  if (!result.success) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: statusForErrorCode(result.error.code) });
  }

  const filename = `venore-aparencia-${result.data.theme.key}-${result.data.exportedAt.slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(result.data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
