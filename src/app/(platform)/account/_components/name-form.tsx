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
        <Input value={name ?? ""} disabled readOnly />
        <p className="text-xs text-muted-foreground/56">
          Definido pelo provedor de login (Google, GitHub, Microsoft) — não pode ser editado aqui.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input name="name" defaultValue={name ?? ""} required className="sm:max-w-sm" />
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
