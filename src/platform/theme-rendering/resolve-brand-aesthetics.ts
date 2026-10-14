import { cache } from "react";
import type { BrandAesthetics } from "@/contexts/themes";
import { THEME_REGISTRY } from "@/themes/registry";
import { resolveDocumentModel } from "./document-model";
import { FALLBACK_THEME_KEY } from "./resolve-theme-definition";

// T2 (docs/implementation-roadmap.md — Fase 5): brand.mode/size/scrolledSize/position/color não
// vêm mais de contexts/settings — vêm do manifest do tema ativo. cache() pelo mesmo motivo de
// resolveActiveTheme: mais de um consumidor no mesmo request (layout.tsx, resolve-theme-slot-
// props.ts, admin/birthdays/page.tsx) sem duplicar a leitura de contexts/settings por trás de
// resolveActiveTheme.
export const resolveBrandAesthetics = cache(async (): Promise<BrandAesthetics> => {
  // Chave do tema da config já lida pelo modelo do documento (cache() por request) — antes era
  // resolveActiveTheme(), uma leitura extra e sem cache de `theme.active` em todo render. A
  // publicação grava `theme.active` = `theme.config.themeKey` (dual-write, published-settings.ts),
  // então o valor é o mesmo; em preview de rascunho passa a seguir o tema do rascunho.
  const { config } = await resolveDocumentModel();
  const entry = THEME_REGISTRY[config.themeKey] ?? THEME_REGISTRY[FALLBACK_THEME_KEY];
  return entry.manifest.brandAesthetics;
});
