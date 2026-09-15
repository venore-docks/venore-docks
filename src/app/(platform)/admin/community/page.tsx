import Link from "next/link";
import { searchUsers } from "@/contexts/auth";
import type { UserRegistrationStatus } from "@/contexts/auth";
import { getCommunityPageData } from "@/platform/admin-shell/get-community-page-data";
import { AdminAccessDenied } from "@/components/admin-access-denied";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AddUserDialog } from "./_components/add-user-dialog";
import { USER_STATUS_LABEL, UsersTable } from "./_components/users-table";

type CommunitySearchParams = {
  search?: string;
  status?: string;
  cursor?: string;
};

const STATUS_FILTER_VALUES: UserRegistrationStatus[] = ["pending", "approved", "frozen", "rejected", "removed"];

function parseStatus(value: string | undefined): UserRegistrationStatus | undefined {
  return STATUS_FILTER_VALUES.find((status) => status === value);
}

function buildLoadMoreHref(searchParams: CommunitySearchParams, cursor: string): string {
  const params = new URLSearchParams();
  if (searchParams.search) params.set("search", searchParams.search);
  if (searchParams.status) params.set("status", searchParams.status);
  params.set("cursor", cursor);
  return `/admin/community?${params.toString()}`;
}

export default async function CommunityAdminPage({
  searchParams,
}: {
  searchParams: Promise<CommunitySearchParams>;
}) {
  const gate = await getCommunityPageData();

  if (!gate.granted) {
    return <AdminAccessDenied message="Você não tem permissão para gerenciar a comunidade." />;
  }

  const resolvedSearchParams = await searchParams;
  const canManage = gate.actor.isSuperadmin || gate.actor.permissions.includes("rbac.users.manage");
  const canRemove = gate.actor.isSuperadmin || gate.actor.permissions.includes("rbac.users.remove");

  const result = await searchUsers({
    search: resolvedSearchParams.search || undefined,
    status: parseStatus(resolvedSearchParams.status),
    cursor: resolvedSearchParams.cursor,
  });

  if (!result.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar a comunidade agora. Tente recarregar a página.</p>;
  }

  const { entries, hasMore } = result.data;
  const lastEntry = entries[entries.length - 1];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Comunidade"
        description="Contas da plataforma: aprove cadastros, gerencie status e veja o perfil de cada usuário."
        actions={canManage ? <AddUserDialog /> : undefined}
      />

      <form method="GET" className="flex flex-wrap gap-2">
        <Input
          type="search"
          name="search"
          defaultValue={resolvedSearchParams.search ?? ""}
          placeholder="Buscar por nome ou email..."
          className="h-9 max-w-sm"
        />
        <select
          name="status"
          defaultValue={resolvedSearchParams.status ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Todos os status</option>
          {STATUS_FILTER_VALUES.map((status) => (
            <option key={status} value={status}>
              {USER_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Filtrar
        </Button>
      </form>

      <UsersTable users={entries} canRemove={canRemove} />

      {hasMore && lastEntry && (
        <div className="text-center">
          <Link
            href={buildLoadMoreHref(resolvedSearchParams, lastEntry.id)}
            className="rounded-sm text-sm font-medium text-foreground outline-none ui-motion-base hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Carregar mais
          </Link>
        </div>
      )}
    </div>
  );
}
