"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  checkThemeUpdateAction,
  applyThemeUpdateAction,
  type ThemeUpdateCheckState,
  type ThemesActionState,
} from "../actions";

const initialCheckState: ThemeUpdateCheckState = { status: null, error: null };
const initialApplyState: ThemesActionState = { error: null };

// Só aparece pra quem tem platform.extensions.update (gate em page.tsx) — mais sensível que
// habilitar/desabilitar tema, porque "Atualizar" comita no repo do site e aciona um deploy real
// (docs/venore-docks.md — dependência de tema é git+tag resolvido em build-time, não dá pra
// hot-swap dentro do processo já deployado).
export function ThemeUpdatePanel({ themeKey, themeName }: { themeKey: string; themeName: string }) {
  const [checkState, checkAction, checkPending] = useActionState(checkThemeUpdateAction, initialCheckState);
  const [applyState, applyAction, applyPending] = useActionState(applyThemeUpdateAction, initialApplyState);

  useActionToast({ pending: checkPending, error: checkState.error });
  useActionToast({
    pending: applyPending,
    error: applyState.error,
    successMessage:
      "Atualização disparada — o deploy leva alguns minutos; a versão instalada só reflete depois do novo build.",
  });

  const status = checkState.status;

  if (!status) {
    return (
      <form action={checkAction}>
        <input type="hidden" name="themeKey" value={themeKey} />
        <Button type="submit" variant="ghost" size="sm" disabled={checkPending}>
          {checkPending ? "Verificando…" : `Verificar atualização de ${themeName}`}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Instalada</span>
      <Badge variant="outline">v{status.installedVersion}</Badge>
      {status.latestVersion && (
        <>
          <span>· Disponível</span>
          <Badge variant={status.updateAvailable ? "default" : "outline"}>v{status.latestVersion}</Badge>
        </>
      )}
      {status.updateAvailable && status.latestTag && (
        <form action={applyAction}>
          <input type="hidden" name="themeKey" value={themeKey} />
          <input type="hidden" name="targetTag" value={status.latestTag} />
          <Button type="submit" variant="outline" size="sm" disabled={applyPending}>
            {applyPending ? "Atualizando…" : "Atualizar"}
          </Button>
        </form>
      )}
    </div>
  );
}
