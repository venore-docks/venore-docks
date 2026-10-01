import { NextResponse } from "next/server";
import { checkHealth } from "@/platform/health/check-health";

export const dynamic = "force-dynamic";

// GET /api/health — 200 com o app e o banco de pé, 503 quando o banco não responde.
export async function GET(): Promise<NextResponse> {
  const report = await checkHealth();
  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
