"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import type { NavVisibility } from "@/platform/nav-visibility/get-nav-visibility";
import { updateNavVisibilityAction, type ThemesActionState } from "../actions";

const initialState: ThemesActionState = { error: null };

// Sem gate de manifest.capabilities (ao contrário de HeaderBehaviorForm ao lado): esconder
// "Entrar" é uma decisão de instância, não de tema — qualquer tema que renderize
// HeaderSlotProps.showLoginLink/FooterSlotProps.loginLinkHref respeita, os demais ignoram
// (extensão aditiva do contrato de slot).
export function NavVisibilityForm({ visibility }: { visibility: NavVisibility }) {
  const [state, formAction, pending] = useActionState(updateNavVisibilityAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Visibilidade da navegação salva." });

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Navegação</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A rota /login continua acessível por link direto mesmo com o link escondido abaixo.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="hideLoginLink"
          defaultChecked={visibility.hideLoginLink}
          className="mt-0.5 outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span>
          Esconder o link de &quot;Entrar&quot; da navegação
          <span className="block text-xs text-muted-foreground">Útil quando só administradores devem acessar o login.</span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="showLoginInFooter"
          defaultChecked={visibility.showLoginInFooter}
          className="mt-0.5 outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span>
          Manter um link de acesso no rodapé
          <span className="block text-xs text-muted-foreground">Só tem efeito com a opção acima marcada.</span>
        </span>
      </label>

      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
