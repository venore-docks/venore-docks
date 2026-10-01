"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { revokeUserSessionsAction, type CommunityActionState } from "../actions";

const initialState: CommunityActionState = { error: null };

export function RevokeSessionsButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(revokeUserSessionsAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Sessões encerradas." });

  return (
    <form action={formAction}>
      <input type="hidden" name="targetUserId" value={userId} />
      <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-xs text-foreground" disabled={pending}>
        <LogOut className="size-3" /> Encerrar sessões
      </Button>
    </form>
  );
}
