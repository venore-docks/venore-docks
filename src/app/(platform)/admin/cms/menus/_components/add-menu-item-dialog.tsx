"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconPicker } from "@/components/icon-picker";
import { useActionToast } from "@/hooks/use-action-toast";
import { NAV_ICON_KEYS } from "@/platform/nav-icons/registry";
import { createMenuItemAction, type MenuActionState } from "../actions";
import { ContentPicker } from "./content-picker";
import type { ContentSearchResult } from "../actions";

const initialState: MenuActionState = { error: null };

const TARGET_TYPE_OPTIONS = [
  { value: "content", label: "Conteúdo publicado" },
  { value: "route", label: "Rota interna" },
  { value: "external", label: "URL externa" },
  { value: "label", label: "Rótulo sem link (agrupador)" },
];

const ICON_OPTIONS = [{ value: "", label: "Sem ícone" }, ...NAV_ICON_KEYS.map((key) => ({ value: key, label: key }))];

export function AddMenuItemDialog({
  menuId,
  parentId,
  parentLabel,
  trigger,
}: {
  menuId: string;
  parentId: string | null;
  parentLabel?: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState("content");
  const [selectedContent, setSelectedContent] = useState<ContentSearchResult | null>(null);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [state, formAction, pending] = useActionState(createMenuItemAction, initialState);

  useActionToast({
    pending,
    error: state.error,
    successMessage: "Item adicionado ao menu.",
    onSuccess: () => {
      setOpen(false);
      setSelectedContent(null);
      setLabel("");
      setIcon("");
      setOpenInNewTab(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar item{parentLabel ? ` em "${parentLabel}"` : ""}</DialogTitle>
          <DialogDescription>
            O rótulo do item é independente do título do conteúdo — você pode encurtar o texto exibido no menu.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="menuId" value={menuId} />
          {parentId && <input type="hidden" name="parentId" value={parentId} />}
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="openInNewTab" value={openInNewTab ? "true" : "false"} />
          {targetType === "content" && selectedContent && (
            <input type="hidden" name="contentId" value={selectedContent.id} />
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground">Destino</label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetType === "content" && (
            <>
              <ContentPicker selected={selectedContent} onSelect={setSelectedContent} />
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Âncora (opcional)</label>
                <Input name="anchor" className="mt-1" placeholder="ex: sobre-nos" />
                <p className="mt-1 text-xs text-muted-foreground/56">
                  Id de âncora de um bloco da página (definido no Editor visual) — o link aponta para /pagina#âncora.
                </p>
              </div>
            </>
          )}

          {targetType === "route" && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Rota</label>
                <Input name="routePath" required className="mt-1" placeholder="ex: /admin/media" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Permission exigida (opcional)
                </label>
                <Input name="requiredPermissionKey" className="mt-1" placeholder="ex: media.manage" />
              </div>
            </>
          )}

          {targetType === "external" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground">URL externa</label>
              <Input name="externalUrl" required type="url" className="mt-1" placeholder="https://" />
              <p className="mt-1 text-xs text-muted-foreground/56">Link externo sempre abre em uma nova aba.</p>
            </div>
          )}

          {(targetType === "content" || targetType === "route") && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={openInNewTab}
                onChange={(event) => setOpenInNewTab(event.target.checked)}
                className="size-4"
              />
              Abrir em nova aba
            </label>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground">Ícone (opcional)</label>
            <div className="mt-1">
              <IconPicker value={icon} onChange={setIcon} options={ICON_OPTIONS} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground">Rótulo no menu</label>
            <Input
              name="label"
              required
              className="mt-1"
              placeholder={targetType === "content" && selectedContent ? selectedContent.title : "ex: Contato"}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || (targetType === "content" && !selectedContent)}>
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
