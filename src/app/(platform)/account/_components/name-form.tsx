"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateOwnNameAction, type AccountActionState } from "../actions";

const initialState: AccountActionState = { error: null };

// `editable` vem de authProvider da sessão atual (page.tsx) — só "credentials" edita o próprio
// nome; OAuth mostra o campo travado com uma nota, porque o nome já é sincronizado do provedor a
// cada login (auth.config.ts) e uma edição manual seria sobrescrita no próximo login mesmo assim.
export function NameForm({ name, editable }: { name: string | null; editable: boolean }) {
  const [state, formAction, pending] = useActionState(updateOwnNameAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Nome atualizado." });

  if (!editable) {
    return (
      <div className="space-y-2">
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Nome
          <Input value={name ?? ""} disabled readOnly />
        </label>
        <p className="text-xs text-muted-foreground/56">
          Definido pelo provedor de login (Google, GitHub, Microsoft) — não pode ser editado aqui.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm text-foreground sm:max-w-sm">
        Nome
        <Input name="name" defaultValue={name ?? ""} required />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
