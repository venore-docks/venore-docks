"use client";

import type { ClientErrorStateProps } from "@/contexts/themes/contracts/v8";
import { t } from "../i18n/t";

// ErrorState do kit (client). Primeiro render de app/error.tsx e (platform)/error.tsx; o tema
// pode trocar via "<pkg>/theme-client" depois do mount (spec §6). Dono: W4.
export function KitErrorState({ reset, strings }: ClientErrorStateProps) {
  return (
    <div role="alert" className="mx-auto max-w-md space-y-4 rounded-panel border border-border bg-card p-8 text-center shadow-panel">
      <h1 className="text-lg font-semibold text-foreground">{t(strings, "error.title")}</h1>
      <p className="text-sm text-muted-foreground">{t(strings, "error.message")}</p>
      <button type="button" onClick={reset} className="text-sm text-primary underline">
        {t(strings, "error.retry")}
      </button>
    </div>
  );
}
