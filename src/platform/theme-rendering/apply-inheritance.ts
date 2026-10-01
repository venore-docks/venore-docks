import type { ResolvedThemeDefinition } from "@/contexts/themes/contracts/v8";

// Herança entre temas (spec §7.1): mescla a definição do filho com as dos ancestrais (`ancestors`
// na ordem [pai, avô, …], já normalizados). Dono: W9 — na Fase F nenhum tema declara `extends`,
// então é identidade.
export function applyInheritance(
  theme: ResolvedThemeDefinition,
  ancestors: readonly ResolvedThemeDefinition[],
): ResolvedThemeDefinition {
  void ancestors;
  return theme;
}
