"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { updateOwnAvatarAction, uploadAvatarAction, type AccountActionState } from "../actions";

const initialState: AccountActionState = { error: null };

export type AvatarPreview = { id: string; filename: string; url: string; contentType: string };

export function AvatarForm({ avatarMedia }: { avatarMedia: AvatarPreview | null }) {
  const [uploadState, uploadFormAction, uploadPending] = useActionState(uploadAvatarAction, initialState);
  useActionToast({ pending: uploadPending, error: uploadState.error, successMessage: "Avatar salvo." });

  const [removeState, removeFormAction, removePending] = useActionState(updateOwnAvatarAction, initialState);
  useActionToast({ pending: removePending, error: removeState.error, successMessage: "Avatar removido." });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {avatarMedia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarMedia.url} alt={avatarMedia.filename} className="size-16 rounded-full object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground/56">Sem avatar</div>
        )}

        {avatarMedia && (
          <form action={removeFormAction}>
            <input type="hidden" name="avatarMediaId" value="" />
            <Button type="submit" variant="outline" size="sm" disabled={removePending} className="text-destructive">
              Remover avatar
            </Button>
          </form>
        )}
      </div>

      <form action={uploadFormAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-foreground">
          Nova imagem
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          className="rounded-sm text-sm text-muted-foreground outline-none ui-motion-base file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring w-full min-w-0"
        />
        </label>
        <Button type="submit" disabled={uploadPending}>
          {uploadPending ? "Enviando..." : "Enviar"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground/56">PNG, JPEG, WEBP ou GIF, até 500KB. Visível só para você e quem administra mídia.</p>
    </div>
  );
}
