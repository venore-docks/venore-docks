import Link from "next/link";
import { Trash2 } from "lucide-react";
import { listDeletedMediaAssets } from "@/contexts/media";
import { getMediaTrashPageData } from "@/platform/admin-shell/get-media-trash-page-data";
import { EmptyState } from "@/components/empty-state";
import { PurgeMediaButton } from "./_components/purge-media-button";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaTrashPage() {
  const gate = await getMediaTrashPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para apagar mídia definitivamente.</p>
      </div>
    );
  }

  const result = await listDeletedMediaAssets();
  if (!result.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar a lixeira agora. Tente recarregar a página.</p>;
  }

  const assets = result.data;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/media" className="text-sm text-muted-foreground hover:underline">
          ← Voltar para Mídia
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Lixeira</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arquivos excluídos continuam aqui até serem apagados definitivamente. Excluir de novo em Mídia não faz nada — a
          ação irreversível só acontece aqui.
        </p>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="size-8" strokeWidth={1.5} />}
          title="A lixeira está vazia"
          description="Arquivos excluídos em Mídia aparecem aqui até serem apagados definitivamente."
        />
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((asset) => (
            <div key={asset.id} className="flex flex-col gap-2 rounded-panel border border-border bg-card p-3">
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-muted">
                {asset.contentType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt={asset.filename} className="h-full w-full object-cover opacity-60" />
                ) : (
                  <span className="text-xs text-muted-foreground/56">arquivo</span>
                )}
              </div>
              <p className="truncate text-sm font-medium text-foreground" title={asset.filename}>
                {asset.filename}
              </p>
              <p className="text-xs text-muted-foreground/56">
                {formatSize(asset.size)} · excluído em {formatDate(asset.deletedAt, DEFAULT_DATE_LOCALE, "short") ?? "—"}
              </p>
              <PurgeMediaButton id={asset.id} filename={asset.filename} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
