import type { RenderOverride } from "@/contexts/themes/contracts/v8";

// Token assinado do override de preview (cookie `venore-theme-preview`, spec §7.2): HMAC sobre o
// payload com prefixo por tipo ("theme-preview:", "theme-gallery:", "theme-safe-mode:") e
// AUTH_SECRET, comparado com timingSafeEqual. Dono: W6 — na Fase F não há override, então nada é
// assinado e nada é aceito.
export const THEME_PREVIEW_COOKIE = "venore-theme-preview";
export const THEME_OVERRIDE_MAX_AGE_SECONDS = 2 * 60 * 60;

export function signThemeOverride(override: RenderOverride): string | null {
  void override;
  return null;
}

export function verifyThemeOverride(token: string | undefined, now: number = Date.now()): RenderOverride | null {
  void token;
  void now;
  return null;
}
