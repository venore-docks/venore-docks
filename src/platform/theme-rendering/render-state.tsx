import type { ReactNode } from "react";
import type { PageStateProps, ResolvedThemeDefinition, ThemeServerStateKey } from "@/contexts/themes/contracts/v8";

// Estado de página do tema (ou do kit) — spec §7.9. Esqueleto da Fase F; dono: W4.
export function renderState(theme: ResolvedThemeDefinition, kind: ThemeServerStateKey, props: PageStateProps): ReactNode {
  const State = theme.states[kind];
  return <State {...props} />;
}
