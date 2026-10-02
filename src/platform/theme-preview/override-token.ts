import { createHmac, timingSafeEqual } from "node:crypto";
import type { RenderOverride } from "@/contexts/themes/contracts/v8";

// Token assinado do override de render (cookie `venore-theme-preview`, spec §7.2/§7.13):
//   <payload base64url>.<HMAC-SHA256 base64url>
// O HMAC é calculado sobre `<prefixo do tipo><payload>` com AUTH_SECRET — o prefixo
// ("theme-preview:", "theme-gallery:", "theme-safe-mode:") separa os domínios de assinatura, então
// um token de um tipo nunca é aceito como de outro, nem um HMAC de outro uso de AUTH_SECRET.
// Comparação com timingSafeEqual. Vida máxima de 2 h (o `exp` assinado não pode passar disso).
// Puro (sem cookie, sem sessão): quem lê o cookie e confere o usuário é read-theme-override.ts.
export const THEME_PREVIEW_COOKIE = "venore-theme-preview";
export const THEME_OVERRIDE_MAX_AGE_SECONDS = 2 * 60 * 60;

const PREFIX_BY_KIND: Record<RenderOverride["kind"], string> = {
  draft: "theme-preview:",
  gallery: "theme-gallery:",
  "safe-mode": "theme-safe-mode:",
};
// Tolerância de relógio entre instâncias ao conferir o teto de 2 h.
const CLOCK_SKEW_MS = 60_000;
const MAX_TOKEN_LENGTH = 2048;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THEME_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function secret(): string | null {
  const value = process.env.AUTH_SECRET;
  return value && value.length > 0 ? value : null;
}

function hmac(kind: RenderOverride["kind"], payload: string, key: string): Buffer {
  return createHmac("sha256", key).update(`${PREFIX_BY_KIND[kind]}${payload}`).digest();
}

// Expiração padrão de um override novo: agora + 2 h (em ms, como Date.now()).
export function themeOverrideExpiry(now: number = Date.now()): number {
  return now + THEME_OVERRIDE_MAX_AGE_SECONDS * 1000;
}

function isValidOverride(value: unknown): value is RenderOverride {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.userId !== "string" || !USER_ID_PATTERN.test(candidate.userId)) return false;
  if (typeof candidate.exp !== "number" || !Number.isFinite(candidate.exp)) return false;
  switch (candidate.kind) {
    case "draft":
      return Object.keys(candidate).length === 4 && typeof candidate.revisionId === "string" && UUID_PATTERN.test(candidate.revisionId);
    case "gallery":
      return Object.keys(candidate).length === 4 && typeof candidate.themeKey === "string" && THEME_KEY_PATTERN.test(candidate.themeKey);
    case "safe-mode":
      return Object.keys(candidate).length === 3;
    default:
      return false;
  }
}

// Só os campos do tipo, em ordem fixa (o payload assinado é exatamente o que será lido).
function canonical(override: RenderOverride): RenderOverride {
  switch (override.kind) {
    case "draft":
      return { kind: "draft", userId: override.userId, revisionId: override.revisionId, exp: override.exp };
    case "gallery":
      return { kind: "gallery", userId: override.userId, themeKey: override.themeKey, exp: override.exp };
    case "safe-mode":
      return { kind: "safe-mode", userId: override.userId, exp: override.exp };
  }
}

// null quando não há AUTH_SECRET ou o override é inválido (nunca assina payload malformado).
export function signThemeOverride(override: RenderOverride): string | null {
  const key = secret();
  if (!key || !isValidOverride(override)) return null;
  const payload = Buffer.from(JSON.stringify(canonical(override)), "utf8").toString("base64url");
  return `${payload}.${hmac(override.kind, payload, key).toString("base64url")}`;
}

// null para qualquer token ausente, malformado, adulterado, de outro tipo de assinatura, vencido
// ou com `exp` além do teto de 2 h a partir de agora.
export function verifyThemeOverride(token: string | undefined, now: number = Date.now()): RenderOverride | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isValidOverride(decoded)) return null;

  const expected = hmac(decoded.kind, payload, key);
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  if (decoded.exp <= now) return null;
  if (decoded.exp - now > THEME_OVERRIDE_MAX_AGE_SECONDS * 1000 + CLOCK_SKEW_MS) return null;
  return decoded;
}

// Opções do cookie (spec §7.2): httpOnly, secure, sameSite=lax, vida ≤ 2 h. `secure` só cai em
// `next dev` (http://), onde o navegador recusaria o cookie.
export function themeOverrideCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    path: "/",
    maxAge: THEME_OVERRIDE_MAX_AGE_SECONDS,
  };
}
