"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptInvitationAction, type AcceptInvitationActionState } from "../../actions";

const initialState: AcceptInvitationActionState = { error: null };

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvitationAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <Input name="name" placeholder="Seu nome" autoComplete="name" required maxLength={120} />
      <PasswordInput name="password" placeholder="Senha (mín. 8 caracteres)" autoComplete="new-password" minLength={8} required />
      <PasswordInput name="confirmPassword" placeholder="Repita a senha" autoComplete="new-password" minLength={8} required />
      {state.error ? (
        <p className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando..." : "Criar conta"}
      </Button>
    </form>
  );
}
