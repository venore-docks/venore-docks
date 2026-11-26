"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActionToast } from "@/hooks/use-action-toast";
import { installPluginAction, type PluginsActionState } from "../actions";

const initialState: PluginsActionState = { error: null };

export function InstallPluginControl({
  pluginKey,
  pluginName,
  hasMigrations,
  hasExampleSeed,
}: {
  pluginKey: string;
  pluginName: string;
  hasMigrations: boolean;
  hasExampleSeed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(installPluginAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Plugin instalado.", onSuccess: () => setOpen(false) });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">Disponível</Badge>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Instalar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar {pluginName}?</DialogTitle>
            <DialogDescription>
              {hasMigrations
                ? "Isso roda as migrations do plugin no banco de dados e habilita a navegação, permissions e blocos que ele contribui. As permissions do plugin são concedidas ao papel Admin."
                : "Isso habilita a navegação, permissions e blocos que o plugin contribui, e concede as permissions dele ao papel Admin. Este plugin não tem schema próprio, então nada é criado no banco."}
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="pluginKey" value={pluginKey} />
            {hasExampleSeed && (
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="seedExample"
                  value="true"
                  className="mt-0.5 size-4 rounded border-border"
                />
                <span>
                  Popular com dados de exemplo — cria conteúdo de demonstração que você pode editar ou remover depois.
                </span>
              </label>
            )}
            <DialogFooter>
              <Button type="submit" variant="default" size="sm" disabled={pending}>
                Confirmar instalação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
