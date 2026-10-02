"use client";

import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import type { ClientErrorStateProps, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { KitErrorState } from "@/theme-sdk/kit/states/error-state";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { THEME_CLIENT_REGISTRY } from "@/themes/registry.client.generated";

export const THEME_STRINGS_SCRIPT_ID = "theme-strings";

let cachedStrings: ThemeStrings | null = null;

function readStrings(): ThemeStrings {
  if (cachedStrings) return cachedStrings;
  try {
    const raw = document.getElementById(THEME_STRINGS_SCRIPT_ID)?.textContent;
    cachedStrings = raw ? { ...KIT_STRINGS_PT_BR, ...(JSON.parse(raw) as ThemeStrings) } : KIT_STRINGS_PT_BR;
  } catch {
    cachedStrings = KIT_STRINGS_PT_BR;
  }
  return cachedStrings;
}

const subscribeNever = () => () => {};
const serverStrings = () => KIT_STRINGS_PT_BR;

// Estado de erro dos error boundaries (spec v8 §6, escada de erro). Primeiro render: ErrorState do
// kit com strings pt-BR (nada de `document` no SSR). Depois do mount: lê data-theme e as strings
// do <script id="theme-strings"> do root layout, e troca pelo ErrorState do tema se o pacote
// publica "<pkg>/theme-client". Dono: W4 (desenho), Fase F (mecânica).
export function ThemeErrorState({ error, reset }: Omit<ClientErrorStateProps, "strings">) {
  // SSR/hidratação: pt-BR do kit; no client, as strings do <script id="theme-strings">.
  const strings = useSyncExternalStore(subscribeNever, readStrings, serverStrings);
  const [ThemeState, setThemeState] = useState<ComponentType<ClientErrorStateProps> | null>(null);

  useEffect(() => {
    const key = document.documentElement.dataset.theme;
    const load = key ? THEME_CLIENT_REGISTRY[key] : undefined;
    if (!load) return;
    let cancelled = false;
    load()
      .then((definition) => {
        if (!cancelled && definition.ErrorState) setThemeState(() => definition.ErrorState!);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const State = ThemeState ?? KitErrorState;
  return <State error={error} reset={reset} strings={strings} />;
}
