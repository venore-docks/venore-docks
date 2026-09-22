"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContentTypeRecord } from "@/contexts/cms";
import { DeleteContentTypeDialog } from "./delete-content-type-dialog";

export function ContentTypesTable({ contentTypes }: { contentTypes: Array<ContentTypeRecord & { entryCount: number }> }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contentTypes;
    return contentTypes.filter((contentType) => contentType.name.toLowerCase().includes(term));
  }, [contentTypes, search]);

  return (
    <div className="space-y-3">
      <Input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por nome..."
        className="h-9 max-w-sm"
      />
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Conteúdos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((contentType) => (
              <TableRow key={contentType.id}>
                <TableCell className="font-medium text-foreground">{contentType.name}</TableCell>
                <TableCell className="text-muted-foreground">{contentType.description ?? "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">{contentType.entryCount}</TableCell>
                <TableCell className="text-right">
                  <DeleteContentTypeDialog
                    contentType={contentType}
                    otherContentTypes={contentTypes.filter((other) => other.id !== contentType.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nenhuma tag encontrada para &ldquo;{search}&rdquo;.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
