"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  confirmMfaEnrollmentAction,
  disableMfaAction,
  startMfaEnrollmentAction,
  type AccountActionState,
  type MfaActionState,
} from "../actions";

const initialEnrollment: MfaActionState = { error: null, step: "idle", qrSvg: null, secret: null, recoveryCodes: null };

export function EnableMfa() {
  const [startState, startAction, starting] = useActionState(startMfaEnrollmentAction, initialEnrollment);
  const [confirmState, confirmAction, confirming] = useActionState(confirmMfaEnrollmentAction, initialEnrollment);
  useActionToast({ pending: starting, error: startState.error });
  useActionToast({ pending: confirming, error: confirmState.error });

  if (confirmState.step === "done" && confirmState.recoveryCodes) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">Verificação em duas etapas ativada.</p>
        <p className="text-sm text-muted-foreground">
          Guarde estes códigos de recuperação num lugar seguro. Cada um vale uma vez, no lugar do código do app, se você perder o
          celular. Eles não serão mostrados de novo.
        </p>
        <ul className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted p-3 font-mono text-sm text-foreground sm:grid-cols-4">
          {confirmState.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (startState.step === "scan" && startState.qrSvg) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Leia o QR code no app autenticador (Google Authenticator, 1Password, Authy...) ou digite a chave. Depois informe o código de
          6 dígitos que aparece no app.
        </p>
        {/* SVG gerado no servidor pela lib qrcode a partir do URI otpauth. */}
        <div className="w-fit overflow-hidden rounded-md" dangerouslySetInnerHTML={{ __html: startState.qrSvg }} />
        <p className="break-all font-mono text-xs text-muted-foreground">{startState.secret}</p>
        <form action={confirmAction} className="flex max-w-sm gap-2">
          <Input name="code" placeholder="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          <Button type="submit" disabled={confirming}>
            {confirming ? "Confirmando..." : "Ativar"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form action={startAction} className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Além da senha, o login pede um código do app autenticador do seu celular. Vale para o login com senha.
      </p>
      <Button type="submit" variant="outline" disabled={starting}>
        {starting ? "Gerando..." : "Ativar verificação em duas etapas"}
      </Button>
    </form>
  );
}

const initialState: AccountActionState = { error: null };

export function DisableMfa({ recoveryCodesLeft }: { recoveryCodesLeft: number }) {
  const [state, formAction, pending] = useActionState(disableMfaAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Verificação em duas etapas desativada." });

  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">Ativa. Códigos de recuperação restantes: {recoveryCodesLeft}.</p>
      <form action={formAction} className="flex max-w-sm gap-2">
        <Input name="code" placeholder="Código do app ou de recuperação" autoComplete="one-time-code" maxLength={12} required />
        <Button type="submit" variant="outline" disabled={pending}>
          Desativar
        </Button>
      </form>
    </div>
  );
}
