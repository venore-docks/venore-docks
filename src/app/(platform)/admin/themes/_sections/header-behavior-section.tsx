import { getHeaderBehavior } from "@/platform/header-behavior/get-header-behavior";
import { getNavVisibility } from "@/platform/nav-visibility/get-nav-visibility";
import { listThemeStates } from "@/platform/theme-engine/list-theme-states";
import { HeaderBehaviorForm } from "../_components/header-behavior-form";
import { NavVisibilityForm } from "../_components/nav-visibility-form";

// Comportamento do header (só quando o tema ativo declara capabilities.headerBehavior) e
// visibilidade do "Entrar" — inalterados (spec v8 §2.13: continuam chaves próprias do settings,
// fora do documento de config). Dono: Fase F.
export async function HeaderBehaviorSection() {
  const [themes, headerBehavior, navVisibility] = await Promise.all([listThemeStates(), getHeaderBehavior(), getNavVisibility()]);
  const activeTheme = themes.find((theme) => theme.isActive);
  const activeThemeSupportsHeaderBehavior = activeTheme?.manifest.capabilities?.headerBehavior ?? false;

  return (
    <>
      {activeThemeSupportsHeaderBehavior && <HeaderBehaviorForm behavior={headerBehavior} />}
      <NavVisibilityForm visibility={navVisibility} />
    </>
  );
}
