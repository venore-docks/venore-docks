"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/contexts/settings";
import { activateTheme } from "@/platform/theme-engine/activate-theme";
import { toggleThemeEnabled } from "@/platform/theme-engine/toggle-theme-enabled";
import { activateColorPalette } from "@/platform/theme-engine/activate-color-palette";
import { CUSTOM_COLOR_TOKENS, setCustomColorPalette } from "@/platform/theme-engine/custom-color-palette";
import { setBrandColorPalette } from "@/platform/theme-engine/brand-color-palette";
import { getThemeUpdateStatus, type ThemeUpdateStatus } from "@/platform/theme-engine/theme-update-status";
import { applyThemeUpdate } from "@/platform/theme-engine/apply-theme-update";
import { resolveActiveTheme } from "@/platform/theme-rendering/resolve-active-theme";
import { HEADER_BEHAVIOR_SETTING_KEYS } from "@/platform/header-behavior/get-header-behavior";
import { NAV_VISIBILITY_SETTING_KEYS } from "@/platform/nav-visibility/get-nav-visibility";

export type ThemesActionState = { error: string | null };
export type ThemeUpdateCheckState = { status: ThemeUpdateStatus | null; error: string | null };

const THEMES_PATH = "/admin/themes";

// Tema, paleta de cor e comportamento de header são renderizados no root layout (data-theme,
// paletteOverrideCss) e no Shell, então valem pra toda rota — revalidar só THEMES_PATH deixava
// as outras páginas servindo o data-theme antigo até essa rota específica ser revisitada (bug:
// "às vezes, ao trocar de página, volta pro tema anterior"). revalidatePath("/", "layout")
// invalida o root layout e, por consequência, toda a árvore de rotas abaixo dele.
const revalidateEverywhere = () => revalidatePath("/", "layout");

// Mesmo padrão de removeRoleAction (/admin/rbac/actions.ts): erro do handler é devolvido de
// verdade via useActionState, nunca descartado silenciosamente (docs/venore-docks.md).
export async function activateThemeAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  const themeKey = String(formData.get("themeKey") ?? "");

  const result = await activateTheme({ themeKey });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidateEverywhere();
  return { error: null };
}

export async function toggleThemeEnabledAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  const themeKey = String(formData.get("themeKey") ?? "");
  const enabled = formData.get("enabled") === "true";

  const result = await toggleThemeEnabled({ themeKey, enabled });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath(THEMES_PATH);
  return { error: null };
}

// T3 (docs/implementation-roadmap.md — Fase 5, fundação): mesmo padrão de activateThemeAction —
// erro devolvido via useActionState, revalida a mesma página.
export async function activateColorPaletteAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  const paletteId = String(formData.get("paletteId") ?? "");

  const result = await activateColorPalette({ paletteId });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidateEverywhere();
  return { error: null };
}

// Movido de admin/settings/appearance/actions.ts (pedido desta sessão: comportamento de header
// junto do tema, não em "identidade do site") — mesmo padrão de action acima, checkbox ausente no
// FormData == desmarcado (semântica padrão de HTML forms, não um "não informado").
export async function updateHeaderBehaviorAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  const entries: Array<{ key: string; value: unknown }> = [
    { key: HEADER_BEHAVIOR_SETTING_KEYS.sticky, value: formData.get("sticky") === "on" },
    { key: HEADER_BEHAVIOR_SETTING_KEYS.scrollShrink, value: formData.get("scrollShrink") === "on" },
  ];

  for (const entry of entries) {
    const result = await setSetting(entry);
    if (!result.success) {
      return { error: result.error.message };
    }
  }

  revalidateEverywhere();
  return { error: null };
}

// Genérico (não amarrado a manifest.capabilities de tema nenhum): esconder "Entrar" da navegação
// é uma decisão de instância (ex: Erasto League), não uma capability que só um tema declara — por
// isso este form é renderizado sempre em page.tsx, ao contrário de HeaderBehaviorForm acima.
export async function updateNavVisibilityAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  const entries: Array<{ key: string; value: unknown }> = [
    { key: NAV_VISIBILITY_SETTING_KEYS.hideLoginLink, value: formData.get("hideLoginLink") === "on" },
    { key: NAV_VISIBILITY_SETTING_KEYS.showLoginInFooter, value: formData.get("showLoginInFooter") === "on" },
  ];

  for (const entry of entries) {
    const result = await setSetting(entry);
    if (!result.success) {
      return { error: result.error.message };
    }
  }

  revalidateEverywhere();
  return { error: null };
}

// Cor personalizada — seção "Avançado" (ampliada de 4 pra 9 tokens, pedido de sessão posterior:
// os 4 originais primary/secondary/background/foreground não bastavam pra dar identidade visual
// perceptível, ver brand-color-palette.ts). Salva todos os campos do form (full-overwrite dos 9
// tokens, ao contrário de updateBrandColorPaletteAction abaixo, que mescla só 5) e já ativa
// "custom" como paleta corrente — o admin não precisa de um segundo clique em "Usar" depois de
// salvar. Campo vazio (input type=color sempre manda algo, mas o campo pode estar ausente do
// FormData se removido do form no futuro) vira token omitido, não string vazia —
// setCustomColorPalette só aceita hex válido ou ausência da chave.
export async function updateCustomColorPaletteAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  function readTokens(mode: "light" | "dark") {
    const result: Record<string, string> = {};
    for (const token of CUSTOM_COLOR_TOKENS) {
      const value = formData.get(`${mode}-${token}`);
      if (typeof value === "string" && value.trim().length > 0) {
        result[token] = value;
      }
    }
    return result;
  }

  // A paleta personalizada é por tema (setting keyed no themeKey) — salva contra o tema ativo.
  const { manifest } = await resolveActiveTheme();
  const saveResult = await setCustomColorPalette(manifest.key, {
    light: readTokens("light"),
    dark: readTokens("dark"),
  });
  if (!saveResult.success) {
    return { error: saveResult.error.message };
  }

  const activateResult = await activateColorPalette({ paletteId: saveResult.data.id });
  if (!activateResult.success) {
    return { error: activateResult.error.message };
  }

  revalidateEverywhere();
  return { error: null };
}

// "1 cor de marca" — fluxo principal da seção "Paleta de cor" (pedido desta sessão): o admin
// escolhe 1 hex, setBrandColorPalette gira o matiz sobre os 5 tokens que carregam a identidade
// visual do tema (primary/-foreground, accent/-foreground, ring) preservando luminosidade/
// contraste de cada um, mescla com qualquer ajuste prévio do Avançado, e já ativa "custom" — mesmo
// padrão de auto-ativação de updateCustomColorPaletteAction acima.
export async function updateBrandColorPaletteAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  const hex = String(formData.get("hex") ?? "");

  const saveResult = await setBrandColorPalette({ hex });
  if (!saveResult.success) {
    return { error: saveResult.error.message };
  }

  const activateResult = await activateColorPalette({ paletteId: saveResult.data.id });
  if (!activateResult.success) {
    return { error: activateResult.error.message };
  }

  revalidateEverywhere();
  return { error: null };
}

// Consulta a versão instalada (código já bundlado, THEME_REGISTRY) contra a última tag do repo
// do tema no GitHub — sob demanda (botão "Verificar atualização"), nunca no load da página: é
// uma chamada de rede externa por tema, sem motivo pra pagar isso sempre.
export async function checkThemeUpdateAction(
  _prevState: ThemeUpdateCheckState,
  formData: FormData,
): Promise<ThemeUpdateCheckState> {
  const themeKey = String(formData.get("themeKey") ?? "");

  const result = await getThemeUpdateStatus(themeKey);
  if (!result.success) {
    return { status: null, error: result.error.message };
  }
  return { status: result.data, error: null };
}

// Dispara a atualização de verdade (commit + push, que aciona o deploy da Vercel) — não muda
// nada em cache/DB local, então sem revalidatePath: a versão instalada só reflete depois do
// próximo build (novo processo, novo THEME_REGISTRY).
export async function applyThemeUpdateAction(
  _prevState: ThemesActionState,
  formData: FormData,
): Promise<ThemesActionState> {
  const themeKey = String(formData.get("themeKey") ?? "");
  const targetTag = String(formData.get("targetTag") ?? "");

  const result = await applyThemeUpdate({ themeKey, targetTag });
  if (!result.success) {
    return { error: result.error.message };
  }

  return { error: null };
}
