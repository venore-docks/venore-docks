import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Cifra simétrica (AES-256-GCM) pra segredos guardados no banco (segredo TOTP). Chave derivada do
// AUTH_SECRET — um dump do banco sozinho não entrega o segundo fator. Trocar o AUTH_SECRET
// invalida os segredos (as pessoas reativam a verificação em duas etapas).
function key(): Buffer {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ausente — não dá pra cifrar segredos.");
  return createHash("sha256").update(`venore:secret-box:${secret}`).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function openSecret(sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
