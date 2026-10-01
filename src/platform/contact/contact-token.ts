import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Token do formulário de contato: destinatário + expiração cifrados (AES-256-GCM, chave derivada
// do AUTH_SECRET). O HTML não expõe o e-mail (raspagem) e o cliente não troca o destinatário
// (o servidor nunca manda pra um endereço vindo do formulário).
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function key(): Buffer {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ausente — formulário de contato indisponível.");
  return createHash("sha256").update(`venore:contact-form:${secret}`).digest();
}

export function sealContactToken(recipient: string, now = Date.now()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = JSON.stringify({ r: recipient, e: now + TTL_MS });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function openContactToken(token: string, now = Date.now()): { recipient: string } | null {
  const [iv, tag, data] = token.split(".");
  if (!iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")) as {
      r?: unknown;
      e?: unknown;
    };
    if (typeof payload.r !== "string" || typeof payload.e !== "number" || payload.e < now) return null;
    return { recipient: payload.r };
  } catch {
    return null;
  }
}
