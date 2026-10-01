import type { ReactNode } from "react";
import type { ResolvedThemeDefinition, TemplatePropsByKey, ThemeTemplateKey } from "@/contexts/themes/contracts/v8";

// Escolhe o template do tema (variante pedida → "default" → kit) e renderiza com o dado já
// resolvido pela página (spec §6 — "pages: data unchanged → renderTemplate"). Esqueleto da Fase F;
// W4 liga as páginas a ele e fecha os templates do kit.
export function renderTemplate<K extends ThemeTemplateKey>(
  theme: ResolvedThemeDefinition,
  key: K,
  props: TemplatePropsByKey[K],
  options: { variant?: string | null } = {},
): ReactNode {
  const variants = theme.templates[key];
  const Template = (options.variant ? variants[options.variant] : undefined) ?? variants.default;
  return <Template {...props} />;
}
