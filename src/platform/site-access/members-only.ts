import { cache } from "react";
import { getSetting } from "@/contexts/settings";

// Site só para logados (setting platform.members_only). Ligado, o (platform)/layout manda quem não
// tem sessão para /login?callbackUrl=<caminho>. /login, /setup etc. vivem no grupo (auth), /api e
// /ext ficam fora do (platform)/layout — continuam abertos sem precisar de lista. `openPaths` cobre o
// resto (ex.: página pública de um plugin que o WordPress consome): prefixo por segmento.
export const MEMBERS_ONLY_SETTING_KEY = "platform.members_only";
export const MEMBERS_ONLY_MAX_OPEN_PATHS = 50;

export type MembersOnlySetting = { enabled: boolean; openPaths: string[] };

export function normalizeOpenPath(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, "");
  if (value.length === 0 || value.length > 200) return null;
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  if (withSlash.startsWith("//") || /[\s\u0000-\u001f?#]/.test(withSlash)) return null;
  return withSlash === "" ? null : withSlash;
}

// Forma inesperada = desligado: o site nunca fecha "por engano" (mesmo critério da manutenção).
export function parseMembersOnlySetting(value: unknown): MembersOnlySetting {
  if (!value || typeof value !== "object") return { enabled: false, openPaths: [] };
  const record = value as { enabled?: unknown; openPaths?: unknown };
  const openPaths = Array.isArray(record.openPaths)
    ? record.openPaths.flatMap((item) => (typeof item === "string" ? (normalizeOpenPath(item) ?? []) : []))
    : [];
  return { enabled: record.enabled === true, openPaths: openPaths.slice(0, MEMBERS_ONLY_MAX_OPEN_PATHS) };
}

export function isPathOpen(pathname: string, openPaths: readonly string[]): boolean {
  return openPaths.some((open) => pathname === open || pathname.startsWith(`${open}/`));
}

export const readMembersOnlySetting = cache(async (): Promise<MembersOnlySetting> => {
  const result = await getSetting({ key: MEMBERS_ONLY_SETTING_KEY });
  if (!result.success || !result.data) return { enabled: false, openPaths: [] };
  return parseMembersOnlySetting(result.data.value);
});
