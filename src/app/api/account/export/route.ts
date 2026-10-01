import { NextResponse } from "next/server";
import { getSessionIdentity } from "@/contexts/auth";
import { checkRateLimit } from "@/infrastructure/rate-limit";
import { collectOwnData } from "@/platform/privacy/collect-own-data";

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

// GET /api/account/export — JSON com os dados da própria conta (só a sessão atual).
export async function GET(): Promise<NextResponse> {
  const identity = await getSessionIdentity();
  if (!identity.success || !identity.data) {
    return NextResponse.json({ error: "É necessário estar autenticado." }, { status: 401 });
  }
  const limit = await checkRateLimit(`account.export:${identity.data.id}`, EXPORT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Muitas exportações seguidas. Tente de novo mais tarde." }, { status: 429 });
  }

  const data = await collectOwnData();
  if (!data) {
    return NextResponse.json({ error: "É necessário estar autenticado." }, { status: 401 });
  }
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
