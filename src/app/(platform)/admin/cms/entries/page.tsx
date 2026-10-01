import Link from "next/link";
import { FileText } from "lucide-react";
import { listCategoriesForAdmin, listContentTypes, listEntriesForAdmin, type EntryStatus } from "@/contexts/cms";
import { getCmsPageData } from "@/platform/admin-shell/get-cms-page-data";
import { EmptyState } from "@/components/empty-state";
import { PaginationLinks, parsePageParam } from "@/components/pagination-links";
import { EntriesTable } from "../_components/entries-table";

const PAGE_SIZE = 50;
const ENTRY_STATUSES: EntryStatus[] = ["draft", "scheduled", "published", "archived"];

type EntriesSearchParams = { q?: string; status?: string; tag?: string; page?: string };

export default async function CmsEntriesAdminPage({ searchParams }: { searchParams: Promise<EntriesSearchParams> }) {
  const gate = await getCmsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar o conteúdo do site.</p>
      </div>
    );
  }

  const canManageEntries = gate.actor.isSuperadmin || gate.actor.permissions.includes("cms.entries.manage");
  if (!canManageEntries) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar conteúdos.</p>
      </div>
    );
  }

  // Filtros e página na URL (busca no banco, não no cliente): a listagem não carrega mais todas
  // as entries de uma vez.
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const search = params.q?.trim() || undefined;
  const status = ENTRY_STATUSES.includes(params.status as EntryStatus) ? (params.status as EntryStatus) : undefined;
  const tag = params.tag || undefined;
  const hasFilters = Boolean(search || status || tag);

  const [contentTypesResult, categoriesResult, entriesResult] = await Promise.all([
    listContentTypes(),
    listCategoriesForAdmin(),
    listEntriesForAdmin({ search, status, contentTypeId: tag, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
  ]);

  if (!contentTypesResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar as tags agora. Tente recarregar a página.</p>;
  }
  if (!categoriesResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar as categorias agora. Tente recarregar a página.</p>;
  }
  if (!entriesResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar os conteúdos agora. Tente recarregar a página.</p>;
  }

  const contentTypes = contentTypesResult.data;
  const categories = categoriesResult.data;
  const hasNextPage = entriesResult.data.length > PAGE_SIZE;
  const entries = entriesResult.data.slice(0, PAGE_SIZE);
  const isEmptySite = entries.length === 0 && page === 1 && !hasFilters;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Conteúdos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Todos os conteúdos do site, em qualquer status.</p>
        </div>
        {!isEmptySite && (
          <Link
            href="/admin/cms/entries/new"
            className="ui-button-base ui-button-sm bg-primary text-primary-foreground outline-none ui-motion-base hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Novo conteúdo
          </Link>
        )}
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        {isEmptySite ? (
          <EmptyState
            icon={<FileText className="size-8" strokeWidth={1.5} />}
            title="Nenhum conteúdo ainda"
            description="Os conteúdos que você criar aqui aparecem nesta lista, em qualquer status."
            action={
              <Link
                href="/admin/cms/entries/new"
                className="ui-button-base ui-button-sm bg-primary text-primary-foreground outline-none ui-motion-base hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Novo conteúdo
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            <EntriesTable
              entries={entries}
              contentTypes={contentTypes}
              categories={categories}
              filters={{ search: search ?? "", status: status ?? "all", tag: tag ?? "all" }}
            />
            <PaginationLinks
              basePath="/admin/cms/entries"
              params={{ q: search, status, tag }}
              page={page}
              hasNextPage={hasNextPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
