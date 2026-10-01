"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction, type PasswordResetActionState } from "../actions";

const initialState: PasswordResetActionState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <Input name="email" type="email" placeholder="Email da conta" autoComplete="email" required />
      {state.error ? (
        <p className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
