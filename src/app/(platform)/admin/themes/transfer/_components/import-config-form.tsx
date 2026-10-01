"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { importThemeConfigAction, type ConfigActionState } from "../../_actions/config";

const initialState: ConfigActionState = { error: null, warnings: [], done: false };

// Importar cria SÓ um rascunho (spec §7.10) — o admin revisa em Personalizar e publica de lá.
export function ImportConfigForm() {
  const [state, formAction, pending] = useActionState(importThemeConfigAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1 text-sm text-foreground">
        <span>Arquivo exportado (.json, até 256 KB)</span>
        <input
          type="file"
          name="file"
          accept="application/json,.json"
          required
          className="block w-full text-sm text-muted-foreground file:me-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-foreground"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Importando…" : "Importar como rascunho"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.done && (
        <div className="space-y-1 text-sm text-foreground" aria-live="polite">
          <p>
            Rascunho criado. <Link href="/admin/themes/customize" className="text-primary underline">Revisar e publicar em Personalizar</Link>.
          </p>
          {state.warnings.length > 0 && (
            <ul className="list-disc space-y-1 ps-5 text-xs text-warning">
              {state.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
