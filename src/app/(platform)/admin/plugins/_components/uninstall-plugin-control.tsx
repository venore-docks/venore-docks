"use client";

import { useActionState, useCallback, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import type { PluginUninstallPreview } from "@/platform/plugin-engine/preview-plugin-uninstall";
import {
  loadUninstallPreviewAction,
  togglePluginEnabledAction,
  uninstallPluginAction,
  type PluginsActionState,
} from "../actions";

const initialState: PluginsActionState = { error: null };

export type PluginLifecycleConsequences = {
  navigationLabels: string[];
  permissionLabels: string[];
  affectedUserCount: number;
  blockedByDependents: { key: string; name: string }[];
};

// Substitui o antigo TogglePluginControl: um único ponto para desativar (modo A, reversível, não
// apaga nada) e desinstalar limpando o banco (modo B, destrutivo, irreversível). O diálogo tem
// dois passos — escolha do modo, depois confirmação digitando a key para o modo B (docs/issues.md
// — "Plugins e Temas").
export function UninstallPluginControl({
  pluginKey,
  pluginName,
  enabled,
  consequences,
}: {
  pluginKey: string;
  pluginName: string;
  enabled: boolean;
  consequences: PluginLifecycleConsequences;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [confirmInput, setConfirmInput] = useState("");
  // Qual das duas desinstalações o admin disparou — só pra escolher a mensagem de sucesso do toast.
  const [purgeSubmitted, setPurgeSubmitted] = useState(false);
  const [preview, setPreview] = useState<PluginUninstallPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [toggleState, toggleAction, togglePending] = useActionState(togglePluginEnabledAction, initialState);
  const [uninstallState, uninstallFormAction, uninstallPending] = useActionState(uninstallPluginAction, initialState);

  const resetDialog = useCallback(() => {
    setStep("choose");
    setConfirmInput("");
    setPurgeSubmitted(false);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    resetDialog();
  }, [resetDialog]);

  useActionToast({
    pending: togglePending,
    error: toggleState.error,
    successMessage: enabled ? "Plugin desativado." : "Plugin reativado.",
    onSuccess: closeDialog,
  });
  useActionToast({
    pending: uninstallPending,
    error: uninstallState.error,
    successMessage: purgeSubmitted
      ? `Plugin "${pluginKey}" desinstalado e removido do banco.`
      : `Plugin "${pluginKey}" desinstalado. Dados preservados no banco.`,
    onSuccess: closeDialog,
  });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetDialog();
    },
    [resetDialog],
  );

  // Carrega o preview de consequência ao entrar no passo de confirmação (event handler, não
  // effect) — evita o COUNT por tabela do plugin no load da página.
  const goToConfirm = useCallback(() => {
    setStep("confirm");
    if (preview || previewLoading) return;
    setPreviewLoading(true);
    loadUninstallPreviewAction(pluginKey)
      .then((result) => {
        if (result.success) {
          setPreview(result.data);
        } else {
          setPreviewError(result.error.message);
        }
      })
      .catch(() => setPreviewError("Não foi possível carregar o preview da desinstalação."))
      .finally(() => setPreviewLoading(false));
  }, [pluginKey, preview, previewLoading]);

  const blocked = consequences.blockedByDependents.length > 0;
  const blockedNames = consequences.blockedByDependents.map((dependent) => dependent.name).join(", ");

  return (
    <div className="flex flex-col items-end gap-2 text-right">
      <div className="flex items-center gap-2">
        <Badge variant={enabled ? "secondary" : "outline"}>{enabled ? "Ativo" : "Inativo"}</Badge>
        {!enabled && (
          <form action={toggleAction}>
            <input type="hidden" name="pluginKey" value={pluginKey} />
            <input type="hidden" name="enabled" value="true" />
            <Button type="submit" variant="outline" size="sm" disabled={togglePending}>
              Reativar
            </Button>
          </form>
        )}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={blocked}>
              {enabled ? "Desativar ou desinstalar…" : "Desinstalar…"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            {step === "choose" ? (
              <>
                <DialogHeader>
                  <DialogTitle>{pluginName}</DialogTitle>
                  <DialogDescription>
                    Escolha o que fazer com este plugin. Só a última opção — limpar o banco — é irreversível.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {enabled && (
                    <div className="rounded-lg border border-border p-3 text-left">
                      <p className="text-sm font-medium text-foreground">Apenas desativar</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Some da navegação e das permissions, mas schema, dados e configurações do plugin ficam
                        intactos no banco. Você pode reativar quando quiser.
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <li>
                          <span className="font-medium text-foreground">Navegação removida:</span>{" "}
                          {consequences.navigationLabels.length > 0
                            ? consequences.navigationLabels.join(", ")
                            : "nenhum item"}
                        </li>
                        <li>
                          <span className="font-medium text-foreground">Permissions removidas:</span>{" "}
                          {consequences.permissionLabels.length > 0
                            ? consequences.permissionLabels.join(", ")
                            : "nenhuma"}
                        </li>
                        <li>
                          <span className="font-medium text-foreground">Usuários afetados:</span>{" "}
                          {consequences.affectedUserCount}
                        </li>
                      </ul>
                      <form action={toggleAction} className="mt-3">
                        <input type="hidden" name="pluginKey" value={pluginKey} />
                        <input type="hidden" name="enabled" value="false" />
                        <Button type="submit" variant="outline" size="sm" disabled={togglePending}>
                          Desativar
                        </Button>
                      </form>
                    </div>
                  )}

                  <div className="rounded-lg border border-border p-3 text-left">
                    <p className="text-sm font-medium text-foreground">Desinstalar (mantém os dados)</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tira o plugin do ar e remove a navegação e as permissions, mas o schema{" "}
                      <span className="font-medium text-foreground">{pluginKey}</span>, todos os seus dados, as
                      configurações e o histórico de migrations continuam no banco. Reinstalar depois aplica só as
                      migrations novas — nada é recriado do zero.
                    </p>
                    <form
                      action={uninstallFormAction}
                      className="mt-3"
                      onSubmit={() => setPurgeSubmitted(false)}
                    >
                      <input type="hidden" name="pluginKey" value={pluginKey} />
                      <input type="hidden" name="purgeData" value="false" />
                      <Button type="submit" variant="outline" size="sm" disabled={uninstallPending}>
                        Desinstalar sem apagar dados
                      </Button>
                    </form>
                  </div>

                  <div className="rounded-lg border-2 border-destructive bg-destructive/5 p-3 text-left">
                    <p className="text-sm font-medium text-destructive">Desinstalar e limpar o banco</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Remove o schema do plugin e todos os seus dados, apaga as configurações e as concessões de
                      permission do namespace <span className="font-medium text-foreground">{pluginKey}.*</span>.
                      Irreversível.
                    </p>
                    <Button type="button" variant="destructive" size="sm" className="mt-3" onClick={goToConfirm}>
                      Continuar
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Desinstalar {pluginName} e limpar o banco?</DialogTitle>
                  <DialogDescription>
                    Isto não pode ser desfeito. Para confirmar, digite a key do plugin:{" "}
                    <span className="font-medium text-foreground">{pluginKey}</span>.
                  </DialogDescription>
                </DialogHeader>

                {previewLoading && <p className="text-sm text-muted-foreground">Analisando o que será removido…</p>}
                {previewError && <p className="text-sm text-destructive">{previewError}</p>}
                {preview && (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>
                      <span className="font-medium text-foreground">Schema removido:</span>{" "}
                      {preview.dataSchema ? (
                        <>
                          {preview.dataSchema}
                          {preview.migrationsSchema ? ` e ${preview.migrationsSchema}` : ""}
                        </>
                      ) : (
                        "nenhum (plugin sem schema próprio)"
                      )}
                    </li>
                    {preview.tables.length > 0 && (
                      <li>
                        <span className="font-medium text-foreground">Tabelas e linhas apagadas:</span>
                        <ul className="mt-1 space-y-0.5 pl-4">
                          {preview.tables.map((table) => (
                            <li key={table.name}>
                              {table.name}: {table.rowCount} linha{table.rowCount === 1 ? "" : "s"}
                            </li>
                          ))}
                        </ul>
                      </li>
                    )}
                    <li>
                      <span className="font-medium text-foreground">Configurações apagadas:</span>{" "}
                      {preview.settingsCount}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Concessões de permission apagadas:</span>{" "}
                      {preview.grantedPermissionCount}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Usuários afetados:</span>{" "}
                      {preview.affectedUserCount}
                    </li>
                  </ul>
                )}

                <form
                  action={uninstallFormAction}
                  className="space-y-3"
                  onSubmit={() => setPurgeSubmitted(true)}
                >
                  <input type="hidden" name="pluginKey" value={pluginKey} />
                  <input type="hidden" name="purgeData" value="true" />
                  <Input
                    name="confirmationKey"
                    autoComplete="off"
                    placeholder={pluginKey}
                    value={confirmInput}
                    onChange={(event) => setConfirmInput(event.target.value)}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" size="sm" onClick={() => setStep("choose")}>
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      size="sm"
                      disabled={uninstallPending || confirmInput.trim() !== pluginKey}
                    >
                      Desinstalar definitivamente
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {blocked && (
        <p className="max-w-64 text-xs text-destructive">
          Depende deste plugin: {blockedNames}. Desative ou desinstale o dependente primeiro.
        </p>
      )}
    </div>
  );
}
