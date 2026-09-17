"use client";

import { useActionState, useState } from "react";
import { MediaPickerField } from "@/components/media-picker-field";
import type { PickableMedia } from "@/components/media-picker-field.actions";
import { AutoSlugField } from "@/components/auto-slug-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateEntryAction, type EditEntryActionState } from "../actions";

const initialState: EditEntryActionState = { error: null };

export function EditEntryForm({
  entryId,
  title,
  slug,
  body,
  hasComposition,
  categoryId,
  contentTypeIds,
  visibility,
  media,
  categories,
  contentTypes,
}: {
  entryId: string;
  title: string;
  slug: string;
  body: string;
  hasComposition: boolean;
  categoryId: string | null;
  contentTypeIds: string[];
  visibility: "public" | "authenticated";
  media: PickableMedia | null;
  categories: { id: string; name: string }[];
  contentTypes: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateEntryAction, initialState);
  const [titleValue, setTitleValue] = useState(title);
  useActionToast({ pending, error: state.error, successMessage: "Alterações salvas." });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={entryId} />

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Título</label>
        <Input
          name="title"
          value={titleValue}
          onChange={(event) => setTitleValue(event.target.value)}
          required
          className="mt-1"
        />
      </div>

      <AutoSlugField name="slug" sourceValue={titleValue} defaultValue={slug} label="Endereço da página" />

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Tags</label>
        <div className="mt-1 space-y-2 rounded-md border border-border p-3">
          {contentTypes.map((contentType) => (
            <label key={contentType.id} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="contentTypeIds"
                value={contentType.id}
                defaultChecked={contentTypeIds.includes(contentType.id)}
                className="size-4"
              />
              {contentType.name}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground/56">Selecione ao menos uma. Um conteúdo pode ter mais de uma tag.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Privacidade</label>
        <Select name="visibility" defaultValue={visibility}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Aberto (qualquer visitante)</SelectItem>
            <SelectItem value="authenticated">Fechado (só logados)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Categoria (opcional)</label>
        <Select name="categoryId" defaultValue={categoryId ?? undefined}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue placeholder="nenhuma" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasComposition ? (
        <p className="text-xs text-muted-foreground/56">
          O conteúdo desta página é editado no Editor visual — esta tela edita só metadados.
        </p>
      ) : (
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Corpo</label>
          <Textarea name="body" rows={8} defaultValue={body} className="mt-1" />
        </div>
      )}

      <MediaPickerField name="mediaId" initialMedia={media} />

      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
