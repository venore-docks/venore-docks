"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bootstrapSuperadminAction, type SetupActionState } from "../actions";
import { PasswordInput } from "../login/password-input";

const initialState: SetupActionState = { error: null };

export function SetupForm({ sessionEmail, passwordEnabled }: { sessionEmail: string | null; passwordEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(bootstrapSuperadminAction, initialState);
  const mode = sessionEmail ? "session" : "create";

  if (!sessionEmail && !passwordEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Entre primeiro com a conta que será o superadmin e volte a esta página.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="mode" value={mode} />
      <Input name="token" type="password" placeholder="Token de configuração (SETUP_TOKEN)" autoComplete="off" required />

      {sessionEmail ? (
        <p className="text-sm text-muted-foreground">
          A conta <span className="font-medium text-foreground">{sessionEmail}</span> se tornará superadmin.
        </p>
      ) : (
        <>
          <Input name="name" placeholder="Nome" autoComplete="name" required />
          <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
          <PasswordInput name="password" placeholder="Senha (mín. 8 caracteres)" autoComplete="new-password" required minLength={8} />
        </>
      )}

      {state.error ? (
        <p className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {sessionEmail ? "Tornar-me superadmin" : "Criar superadmin"}
      </Button>
    </form>
  );
}
