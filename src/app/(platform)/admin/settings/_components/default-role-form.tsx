"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateDefaultRegistrationRoleAction, type SettingsActionState } from "../actions";

const initialState: SettingsActionState = { error: null };

type RoleOption = { id: string; key: string; name: string };

// Papel que conta nova recebe. "" = sem escolha (vale RBAC_DEFAULT_REGISTRATION_ROLE_KEY ou
// "member"). superadmin nunca aparece — a action e contexts/rbac também recusam.
export function DefaultRoleForm({ roles, currentKey }: { roles: RoleOption[]; currentKey: string | undefined }) {
  const [state, formAction, pending] = useActionState(updateDefaultRegistrationRoleAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Papel padrão salvo." });
  const currentId = roles.find((role) => role.key === currentKey)?.id ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        name="roleId"
        defaultValue={currentId}
        aria-label="Papel padrão de novas contas"
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Padrão do sistema (Membro)</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
