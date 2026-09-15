"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { approveUserAction, type CommunityActionState } from "../actions";

const initialState: CommunityActionState = { error: null };

// Reversível (aprovar de novo depois de congelar é outro fluxo) — botão inline direto, sem
// confirmação, mesmo padrão de PublishEntryButton/RemoveRoleButton.
export function ApproveUserButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(approveUserAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Cadastro aprovado." });

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-xs text-foreground" disabled={pending}>
        <Check className="size-3" /> Aprovar
      </Button>
    </form>
  );
}
