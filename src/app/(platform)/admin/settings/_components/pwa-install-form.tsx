"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import type { PwaInstallSetting } from "@/platform/pwa/install-policy";
import { updatePwaInstallAction, type PwaInstallActionState } from "../_actions/pwa-install";

const initialState: PwaInstallActionState = { error: null };
const checkbox = "size-4 rounded-sm border-border outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring";

export function PwaInstallForm({ setting }: { setting: PwaInstallSetting }) {
  const [state, formAction, pending] = useActionState(updatePwaInstallAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Convite de instalação salvo." });

  return (
    <form action={formAction} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="enabled" defaultChecked={setting.enabled} className={checkbox} />
        Oferecer a instalação do app
      </label>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="mobile" defaultChecked={setting.mobile} className={checkbox} />
          Exibir no celular
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="desktop" defaultChecked={setting.desktop} className={checkbox} />
          Exibir no desktop
        </label>
      </div>
      <label className="block space-y-1 text-sm text-muted-foreground">
        <span>Dias sem reexibir depois de dispensar</span>
        <input
          type="number"
          name="cooldownDays"
          min={0}
          max={365}
          defaultValue={setting.cooldownDays}
          className="block h-10 w-28 rounded-md border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
