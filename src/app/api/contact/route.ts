import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/infrastructure/rate-limit";
import { sendContactMessage } from "@/platform/contact/send-contact-message";

export const dynamic = "force-dynamic";

const CONTACT_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };
const MAX_BODY_BYTES = 16 * 1024;

// POST do bloco "Formulário de contato" (público, sem sessão). Limite por IP; o destinatário vem
// cifrado no token (nunca do corpo).
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`contact:${ip}`, CONTACT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Muitas mensagens seguidas. Tente de novo em alguns minutos." }, { status: 429 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Mensagem grande demais." }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  const field = (name: string) => (typeof body[name] === "string" ? (body[name] as string) : "");

  const result = await sendContactMessage({
    token: field("token"),
    name: field("name"),
    email: field("email"),
    message: field("message"),
    website: field("website"),
    turnstileToken: field("turnstileToken") || null,
    ip,
    pageUrl: request.headers.get("referer"),
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
