import { cookies } from "next/headers";
import { getThemeConfigRevision, type GetPublishedThemeConfigResult } from "@/contexts/themes";
import type { RenderOverride } from "@/contexts/themes/contracts/v8";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import type { AdminPageGate } from "@/platform/admin-shell/types";
import { THEME_PREVIEW_COOKIE, verifyThemeOverride } from "@/platform/theme-preview/override-token";
import { isPathUnderPrefix } from "@/shared/normalize-path-prefix";

// Rotas fora da shell (/ext/** — TV, quiosque, telão) nunca entram em preview: são abertas em
// telas compartilhadas, onde a sessão de um admin não deve vazar um rascunho.
const OVERRIDE_IGNORED_PREFIXES = ["/ext"];

export type ThemeOverrideEvaluation = {
  token: string | undefined;
  pathname: string | null;
  gate: AdminPageGate;
  now?: number;
};

function actorCanManageSettings(gate: AdminPageGate): gate is Extract<AdminPageGate, { granted: true }> {
  return gate.granted && (gate.actor.isSuperadmin || gate.actor.permissions.includes("settings.manage"));
}

// Regra pura (testável sem cookie/sessão): token válido (HMAC, tipo, ≤ 2 h, não vencido) E
// pertence ao usuário da sessão E esse usuário ainda tem acesso ao admin + settings.manage E a
// rota não é /ext/**. Qualquer falha ⇒ null (o visitante vê o publicado).
export function evaluateThemeOverride({ token, pathname, gate, now = Date.now() }: ThemeOverrideEvaluation): RenderOverride | null {
  if (pathname && OVERRIDE_IGNORED_PREFIXES.some((prefix) => isPathUnderPrefix(pathname, prefix))) return null;
  const override = verifyThemeOverride(token, now);
  if (!override) return null;
  if (!actorCanManageSettings(gate)) return null;
  if (gate.actor.id !== override.userId) return null;
  return override;
}

// Override de render (rascunho/galeria/safe-mode) do cookie assinado `venore-theme-preview` (spec
// §6 passo 3). Sem cookie, nada de sessão é consultado — visitante anônimo não paga nada a mais.
export async function readThemeOverride(context: { pathname: string | null; area: "public" | "admin" }): Promise<RenderOverride | null> {
  const token = (await cookies()).get(THEME_PREVIEW_COOKIE)?.value;
  if (!token) return null;
  if (context.pathname && OVERRIDE_IGNORED_PREFIXES.some((prefix) => isPathUnderPrefix(context.pathname as string, prefix))) return null;
  if (!verifyThemeOverride(token)) return null;
  const gate = await getAdminPageData();
  return evaluateThemeOverride({ token, pathname: context.pathname, gate });
}

// Passo 4 com override de rascunho: a config renderizada é a do rascunho apontado pelo cookie
// (lido por getThemeConfigRevision, que reautoriza settings.manage). Rascunho descartado/ilegível
// ou tabela ausente ⇒ cai na config publicada (`fallback`), nunca quebra o render.
export async function loadOverrideThemeConfig(
  override: RenderOverride | null,
  fallback: () => Promise<GetPublishedThemeConfigResult>,
): Promise<GetPublishedThemeConfigResult> {
  if (override?.kind !== "draft") return fallback();
  const revision = await getThemeConfigRevision({ revisionId: override.revisionId });
  if (!revision.success || !revision.data) return fallback();
  return {
    success: true,
    data: { ...revision.data.config, revisionId: revision.data.id, publishedAt: revision.data.publishedAt, source: "settings" },
  };
}
