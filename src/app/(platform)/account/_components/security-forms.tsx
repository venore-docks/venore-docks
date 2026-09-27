"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { changeOwnPasswordAction, revokeOtherSessionsAction, type AccountActionState } from "../actions";

const initialState: AccountActionState = { error: null };

export function ChangePasswordForm({ hasPasswordLogin }: { hasPasswordLogin: boolean }) {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initialState);
  // Sucesso termina em redirect pra /account?aviso=... (aviso na página); aqui só o erro.
  useActionToast({ pending, error: state.error });

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-2">
      <PasswordInput
        name="currentPassword"
        placeholder={hasPasswordLogin ? "Senha atual" : "Senha atual (deixe vazio se nunca definiu)"}
        autoComplete="current-password"
        required={hasPasswordLogin}
      />
      <PasswordInput name="newPassword" placeholder="Nova senha (mín. 8 caracteres)" autoComplete="new-password" minLength={8} required />
      <PasswordInput name="confirmPassword" placeholder="Repita a nova senha" autoComplete="new-password" minLength={8} required />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Alterar senha"}
      </Button>
    </form>
  );
}

export function RevokeSessionsForm() {
  const [state, formAction, pending] = useActionState(revokeOtherSessionsAction, initialState);
  useActionToast({ pending, error: state.error });

  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Desconecta esta conta de todos os outros navegadores e dispositivos. Esta sessão continua ativa.
      </p>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Encerrando..." : "Sair dos outros dispositivos"}
      </Button>
    </form>
  );
}
