"use client";

import { useActionState } from "react";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { unfreezeUserAction, type CommunityActionState } from "../actions";

const initialState: CommunityActionState = { error: null };

export function UnfreezeUserButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(unfreezeUserAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Conta reativada." });

  return (
    <form action={formAction}>
      <input type="hidden" name="targetUserId" value={userId} />
      <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-xs text-foreground" disabled={pending}>
        <Flame className="size-3" /> Reativar
      </Button>
    </form>
  );
}
