import { listExtensionStates } from "@/contexts/extensions";

// `isEnabled` para resolveThemeDefinition quando o tema vem de uma SEÇÃO (W6) — o tema ativo nunca
// está desabilitado, mas o de uma seção pode ter sido desligado depois de publicada a config.
// Leitura falha ⇒ trata todos como habilitados (mesmo padrão de list-theme-states: sem estado
// gravado, o tema está habilitado).
export async function loadThemeEnabledCheck(): Promise<(themeKey: string) => boolean> {
  const states = await listExtensionStates({ kind: "theme" });
  const enabled = states.success ? states.data : {};
  return (themeKey) => enabled[themeKey]?.enabled ?? true;
}
