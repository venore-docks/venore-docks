"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { ClientErrorStateProps, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { KitErrorState } from "@/theme-sdk/kit/states/error-state";
import { THEME_CLIENT_REGISTRY } from "@/themes/registry.client.generated";

const SAMPLE_ERROR = Object.assign(new Error("Erro de exemplo da galeria"), { digest: "gallery" });
const noop = () => {};

// Estado "error" (client-only, spec §7.9) do tema da galeria: o ErrorState de "<pkg>/theme-client"
// quando o pacote publica um, senão o do kit — mesma escolha do ThemeErrorState do core, só que
// pela chave da galeria em vez do data-theme do <html>.
export function GalleryErrorState({ themeKey, strings }: { themeKey: string; strings: ThemeStrings }) {
  const [ThemeState, setThemeState] = useState<ComponentType<ClientErrorStateProps> | null>(null);

  useEffect(() => {
    const load = THEME_CLIENT_REGISTRY[themeKey];
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
  }, [themeKey]);

  const State = ThemeState ?? KitErrorState;
  return <State error={SAMPLE_ERROR} reset={noop} strings={strings} />;
}
