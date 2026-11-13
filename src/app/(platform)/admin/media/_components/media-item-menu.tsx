"use client";

import { useTransition } from "react";
import { Check, Copy, FolderInput, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateMediaCategoryAction } from "../actions";

// Menu "⋯" de cada arquivo: mover de categoria sem abrir o detalhe (o gargalo de organizar a
// biblioteca) e copiar o link.
export function MediaItemMenu({
  id,
  url,
  categoryId,
  categories,
}: {
  id: string;
  url: string;
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  function moveTo(target: string | null) {
    if (target === categoryId) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("categoryId", target ?? "");
      const result = await updateMediaCategoryAction({ error: null }, formData);
      if (result.error) toast.error(result.error);
      else toast.success(target ? "Arquivo movido de categoria." : "Categoria removida do arquivo.");
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="icon-sm" disabled={isPending} aria-label="Mais ações">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={copyLink}>
          <Copy className="size-4" />
          Copiar link
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderInput className="size-4" />
            Mover para…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 w-52 overflow-y-auto">
            <DropdownMenuLabel>Categoria</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => moveTo(null)}>
              <span className="flex-1">Sem categoria</span>
              {categoryId === null && <Check className="size-4" />}
            </DropdownMenuItem>
            {categories.length > 0 && <DropdownMenuSeparator />}
            {categories.map((category) => (
              <DropdownMenuItem key={category.id} onSelect={() => moveTo(category.id)}>
                <span className="flex-1 truncate">{category.name}</span>
                {categoryId === category.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
