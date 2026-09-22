"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EntryRecord, EntryStatus } from "@/contexts/cms";
import { PublishEntryButton } from "./publish-entry-button";
import { ScheduleEntryDialog } from "./schedule-entry-dialog";
import { ArchiveEntryButton } from "./archive-entry-button";
import { DeleteEntryDialog } from "./delete-entry-dialog";

const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

const ENTRY_STATUS_BADGE_CLASS: Record<EntryStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-warning-soft text-warning",
  published: "bg-accent/14 text-primary",
  archived: "bg-muted text-muted-foreground/56",
};

// Endereço público (docs/venore-docks.md — decisão de rota: /<slug> sem categoria, /<categoria-
// slug>/<slug> com categoria; tag nunca aparece na URL). Só existe de verdade quando published —
// draft/scheduled/archived não têm página ao vivo pra ver.
function publicHref(entry: EntryRecord, categorySlugById: Map<string, string>): string | null {
  if (entry.status !== "published") return null;
  const categorySlug = entry.categoryId ? categorySlugById.get(entry.categoryId) : null;
  return categorySlug ? `/${categorySlug}/${entry.slug}` : `/${entry.slug}`;
}

export function EntriesTable({
  entries,
  contentTypes,
  categories,
}: {
  entries: EntryRecord[];
  contentTypes: { id: string; name: string }[];
  categories: { id: string; name: string; slug: string }[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EntryStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");

  const contentTypeNameById = useMemo(() => new Map(contentTypes.map((ct) => [ct.id, ct.name])), [contentTypes]);
  const categorySlugById = useMemo(() => new Map(categories.map((category) => [category.id, category.slug])), [categories]);
  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (term && !entry.title.toLowerCase().includes(term)) return false;
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (tagFilter !== "all" && !entry.contentTypeIds.includes(tagFilter)) return false;
      return true;
    });
  }, [entries, search, statusFilter, tagFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por título..."
          className="h-9 max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as EntryStatus | "all")}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(ENTRY_STATUS_LABEL) as EntryStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {ENTRY_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {contentTypes.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {contentTypes.map((contentType) => (
                <SelectItem key={contentType.id} value={contentType.id}>
                  {contentType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead className="hidden w-56 md:table-cell">Tags</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Acessos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((entry) => {
              const href = publicHref(entry, categorySlugById);
              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Link
                      href={`/admin/cms/entries/${entry.id}`}
                      className="rounded-sm font-medium text-foreground outline-none ui-motion-base hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {entry.title}
                    </Link>
                    <p className="text-xs text-muted-foreground/56">/{entry.slug}</p>
                  </TableCell>
                  <TableCell className="hidden align-top text-muted-foreground md:table-cell">
                    {entry.contentTypeIds.length > 0 ? (
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {entry.contentTypeIds.map((id) => (
                          <Badge key={id} variant="outline" className="whitespace-nowrap text-muted-foreground">
                            {contentTypeNameById.get(id) ?? "—"}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {entry.categoryId ? (categoryNameById.get(entry.categoryId) ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={ENTRY_STATUS_BADGE_CLASS[entry.status]} variant="outline">
                      {ENTRY_STATUS_LABEL[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground lg:table-cell">{entry.viewCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      <Link
                        href={`/admin/cms/entries/${entry.id}`}
                        className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none ui-motion-base hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Pencil className="size-3" /> Editar
                      </Link>
                      {href && (
                        <Link
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          <ExternalLink className="size-3" /> Ver ao vivo
                        </Link>
                      )}
                      {entry.status === "draft" && (
                        <>
                          <PublishEntryButton entryId={entry.id} />
                          <ScheduleEntryDialog entryId={entry.id} />
                        </>
                      )}
                      {entry.status === "scheduled" && <PublishEntryButton entryId={entry.id} />}
                      {entry.status === "published" && <ArchiveEntryButton entryId={entry.id} />}
                      {entry.status === "archived" && <DeleteEntryDialog entryId={entry.id} title={entry.title} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhum conteúdo encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
