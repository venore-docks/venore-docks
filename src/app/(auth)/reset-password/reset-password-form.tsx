"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { resetPasswordAction, type PasswordResetActionState } from "../actions";

const initialState: PasswordResetActionState = { error: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <PasswordInput name="password" placeholder="Nova senha (mín. 8 caracteres)" autoComplete="new-password" minLength={8} required />
      <PasswordInput name="confirmPassword" placeholder="Repita a nova senha" autoComplete="new-password" minLength={8} required />
      {state.error ? (
        <p className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
