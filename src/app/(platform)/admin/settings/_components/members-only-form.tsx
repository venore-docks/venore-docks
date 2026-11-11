"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateMembersOnlyAction, type MembersOnlyActionState } from "../_actions/members-only";

const initialState: MembersOnlyActionState = { error: null };

export function MembersOnlyForm({ enabled, openPaths }: { enabled: boolean; openPaths: string[] }) {
  const [state, formAction, pending] = useActionState(updateMembersOnlyAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Acesso ao site salvo." });

  return (
    <form action={formAction} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="size-4 rounded-sm border-border outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
        Exigir login para acessar o site
      </label>
      <label className="block space-y-1 text-sm text-muted-foreground">
        <span>Caminhos que continuam abertos (um por linha, opcional)</span>
        <Textarea name="openPaths" defaultValue={openPaths.join("\n")} rows={3} placeholder="/calendarios" />
      </label>
      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
