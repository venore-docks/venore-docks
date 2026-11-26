"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { deleteOwnAccountAction, type AccountActionState } from "../actions";

const initialState: AccountActionState = { error: null };

export function DeleteAccountForm({ hasPasswordLogin }: { hasPasswordLogin: boolean }) {
  const [state, formAction, pending] = useActionState(deleteOwnAccountAction, initialState);
  useActionToast({ pending, error: state.error });

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Apaga seu nome, e-mail e senha e encerra o acesso. O que você publicou no site continua, sem ligação com você. Não dá para
        desfazer.
      </p>
      <label className="flex flex-col gap-1 text-sm text-foreground">
        Confirme seu e-mail
        <Input name="confirmEmail" type="email" placeholder="voce@exemplo.com" autoComplete="off" required />
      </label>
      {hasPasswordLogin && (
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Senha
          <PasswordInput name="password" autoComplete="current-password" required />
        </label>
      )}
      <Button type="submit" variant="destructive" className="self-start" disabled={pending}>
        {pending ? "Excluindo..." : "Excluir minha conta"}
      </Button>
    </form>
  );
}
