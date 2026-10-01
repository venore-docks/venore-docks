"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { createPreviewLinkAction, type PreviewLinkState } from "../actions";

const initialState: PreviewLinkState = { error: null, url: null, expiresAt: null };

export function PreviewLink({ entryId }: { entryId: string }) {
  const [state, formAction, pending] = useActionState(createPreviewLinkAction, initialState);
  useActionToast({ pending, error: state.error });

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="entryId" value={entryId} />
        <select name="ttlHours" defaultValue="24" aria-label="Validade do link" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
          <option value="24">Válido por 1 dia</option>
          <option value="72">Válido por 3 dias</option>
          <option value="168">Válido por 7 dias</option>
        </select>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Gerando..." : "Gerar link"}
        </Button>
      </form>
      {state.url && (
        <div className="space-y-1">
          <Input readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} aria-label="Link de pré-visualização" />
          <p className="text-xs text-muted-foreground">
            Qualquer pessoa com este link vê a versão atual deste conteúdo até{" "}
            {state.expiresAt ? new Date(state.expiresAt).toLocaleString("pt-BR") : "expirar"}.
          </p>
        </div>
      )}
    </div>
  );
}
