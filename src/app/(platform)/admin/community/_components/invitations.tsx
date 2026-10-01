"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  cancelInvitationAction,
  inviteUserAction,
  type CommunityActionState,
  type InviteActionState,
} from "../actions";

const initialInvite: InviteActionState = { error: null, link: null, emailed: false };

export function InviteForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(inviteUserAction, initialInvite);
  useActionToast({ pending, error: state.error, successMessage: state.emailed ? "Convite enviado por e-mail." : null });

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" placeholder="E-mail da pessoa" required className="sm:max-w-xs" aria-label="E-mail" />
        <select
          name="roleId"
          required
          aria-label="Papel"
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Convidando..." : "Convidar"}
        </Button>
      </form>
      {state.link && (
        <div className="space-y-1">
          <Input readOnly value={state.link} onFocus={(event) => event.currentTarget.select()} aria-label="Link do convite" />
          <p className="text-xs text-muted-foreground">
            {state.emailed ? "Enviado por e-mail. " : "Envio de e-mail não configurado — copie e mande o link. "}Válido por 7 dias, uso único.
          </p>
        </div>
      )}
    </div>
  );
}

const initialCancel: CommunityActionState = { error: null };

export function CancelInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, formAction, pending] = useActionState(cancelInvitationAction, initialCancel);
  useActionToast({ pending, error: state.error, successMessage: "Convite cancelado." });
  return (
    <form action={formAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-xs text-foreground" disabled={pending}>
        Cancelar
      </Button>
    </form>
  );
}
