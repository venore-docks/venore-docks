import type { ComponentType, ReactNode } from "react";
import type { PageStateProps, ResolvedThemeDefinition, ThemeServerStateKey } from "@/contexts/themes/contracts/v8";
import { templateText } from "@/theme-sdk/kit/templates/template-strings";
import { readMaintenanceSetting } from "./resolve-maintenance";

// Estado de página do tema (ou do kit) — spec §7.9. O tema pode trocar cada estado
// (definition.states); normalizeThemeDefinition já completa com KIT_STATES.
export function renderState(theme: ResolvedThemeDefinition, kind: ThemeServerStateKey, props: PageStateProps): ReactNode {
  const State = theme.states[kind];
  if (kind === "maintenance" && props.message == null) {
    return <MaintenanceState State={State} props={props} />;
  }
  return <State {...props} />;
}

// O (platform)/layout chama renderState("maintenance") com `message: null`: a mensagem configurada em
// /admin/settings (ou o texto padrão do kit) entra aqui.
async function MaintenanceState({ State, props }: { State: ComponentType<PageStateProps>; props: PageStateProps }) {
  const setting = await readMaintenanceSetting();
  const message = setting.message.trim() || templateText(props.strings, "maintenance.message");
  return <State {...props} message={message} />;
}
