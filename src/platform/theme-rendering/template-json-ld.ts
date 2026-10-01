import type { ResolvedThemeDefinition } from "@/contexts/themes/contracts/v8";

export type TemplateJsonLdInput =
  | { kind: "home"; siteName: string; url: string }
  | { kind: "entry"; title: string; url: string; publishedAt: string | null; updatedAt: string | null; image: string | null }
  | { kind: "category"; name: string; url: string; description: string | null };

// Dado estruturado por template (spec §7.7), a partir de DTO já filtrado por visibilidade (C7);
// serializado no core com serializeJsonLd. Dono: W4 — na Fase F as páginas não emitem nada novo.
export function buildTemplateJsonLd(theme: ResolvedThemeDefinition, input: TemplateJsonLdInput): Record<string, unknown> | null {
  void theme;
  void input;
  return null;
}
