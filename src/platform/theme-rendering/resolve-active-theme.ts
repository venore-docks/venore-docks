import { cache } from "react";
import { getActiveTheme } from "@/contexts/themes";
import { THEME_REGISTRY, type ThemeRegistryEntry } from "@/themes/registry";

// Ponto de composição fora de contexts/themes (que precisa ficar livre de UI/framework, docs
// linha 112) e fora de src/themes/registry.ts (que é só o fato estático "quais temas existem",
// sem saber qual está ativo). Cruzar "qual tema está ativo" (contexts/themes, banco/cache) com
// "quais componentes implementam aquele tema" (registro estático de código) é responsabilidade
// de platform/, mesmo papel de platform/registration/handle-user-registered.ts.
//
// Write path / estado PERSISTIDO apenas (spec v8 §0.4): preview, rascunho e seção nunca passam
// por aqui — esses só existem em platform/theme-rendering/document-model.ts.
//
// cache() memoiza por request: RootLayout (data-theme no <html>) e PlatformLayout (Slots) chamam
// isso de forma independente no mesmo request, e sem memoização isso seria 2 leituras de
// contexts/settings por página em vez de 1.
export const resolveActiveTheme = cache(async (): Promise<ThemeRegistryEntry> => {
  const active = await getActiveTheme();
  const themeKey = active.success ? active.data.themeKey : "venore-slime";

  const entry = THEME_REGISTRY[themeKey] ?? THEME_REGISTRY["venore-slime"];
  assertThemeEntryHasShell(entry, themeKey);
  return entry;
});

// Duas falhas diferentes, dois tratamentos diferentes (docs/themes/shell-contract.md — Fase 2,
// "erro explícito na carga"). "Configuração de tema ativo ausente/quebrada" (getActiveTheme sem
// sucesso, ou themeKey apontando pra uma chave que não existe no THEME_REGISTRY) já cai no
// fallback pro Venore Slime acima — comportamento correto e documentado
// (docs/venore-docks.md — "Venore Slime é ao mesmo tempo o tema padrão e o fallback"). O que esta
// checagem cobre é diferente: o tema resolvido (seja venore-slime ou qualquer outro) está
// registrado mas não exporta um `Shell` chamável — isso é tema estruturalmente incompleto, não
// ausência de configuração, e não pode virar uma shell de fallback silenciosa da aplicação por
// baixo do tema quebrado. Lança erro explícito, propositalmente sem try/catch nem shell
// alternativa aqui — a aplicação não tem shell própria de reserva (esse é o ponto).
// v8: o equivalente a "ter um Shell" é ter uma `definition` (a árvore vem do kit/tema).
function assertThemeEntryHasShell(entry: ThemeRegistryEntry | undefined, themeKey: string): asserts entry is ThemeRegistryEntry {
  const renderable = entry && (entry.contract === 8 ? typeof entry.definition === "object" && entry.definition !== null : typeof entry.Shell === "function");
  if (!entry || !renderable) {
    throw new Error(
      `Tema "${themeKey}" está registrado em THEME_REGISTRY sem um Shell válido. Um tema sem Shell é erro de carga, não degradação silenciosa (docs/themes/shell-contract.md).`,
    );
  }
}
