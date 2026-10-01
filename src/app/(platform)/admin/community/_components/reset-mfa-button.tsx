"use client";

import { useActionState } from "react";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { resetUserMfaAction, type CommunityActionState } from "../actions";

const initialState: CommunityActionState = { error: null };

export function ResetMfaButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserMfaAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Verificação em duas etapas redefinida." });

  return (
    <form action={formAction}>
      <input type="hidden" name="targetUserId" value={userId} />
      <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-xs text-foreground" disabled={pending}>
        <ShieldOff className="size-3" /> Redefinir 2FA
      </Button>
    </form>
  );
}
