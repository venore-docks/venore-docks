import { cookies } from "next/headers";
import type { NavMode } from "@/contexts/themes";

const NAV_MODE_COOKIE = "nav-mode";

// navMode é um toggle manual persistido em cookie (docs/venore-docks.md — "Shell única"),
// não detecção automática por rota. Se o ator não puder alternar pra admin-nav, ignora o
// cookie e força "main" — evita nav admin "grudada" caso a permission seja revogada depois.
//
// Cookie (não localStorage) de propósito: o servidor monta a sidebar (main-nav vs admin-nav)
// no primeiro render de RootLayout, então precisa ler o valor antes do primeiro paint — só
// cookie é visível nesse ponto. Isso difere do color-mode (next-themes/localStorage): o
// servidor não precisa saber o tema pra montar nada, só a classe "dark" é aplicada no client
// (com suppressHydrationWarning cobrindo o flash), então localStorage já resolve. Não
// unificar os dois só por simetria — cada um resolve uma necessidade diferente.
export async function getNavMode(canToggleAdminNav: boolean): Promise<NavMode> {
  if (!canToggleAdminNav) {
    return "main";
  }

  const store = await cookies();
  return store.get(NAV_MODE_COOKIE)?.value === "admin" ? "admin" : "main";
}

export { NAV_MODE_COOKIE };
