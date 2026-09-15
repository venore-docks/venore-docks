import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UserRegistrationStatus, UserSummary } from "@/contexts/auth";
import { ApproveUserButton } from "./approve-user-button";
import { FreezeUserDialog } from "./freeze-user-dialog";
import { RejectUserDialog } from "./reject-user-dialog";
import { RemoveUserDialog } from "./remove-user-dialog";
import { UnfreezeUserButton } from "./unfreeze-user-button";

export const USER_STATUS_LABEL: Record<UserRegistrationStatus, string> = {
  pending: "Pendente",
  approved: "Ativo",
  rejected: "Rejeitado",
  frozen: "Congelado",
  removed: "Removido",
};

export const USER_STATUS_BADGE_CLASS: Record<UserRegistrationStatus, string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-accent/14 text-primary",
  rejected: "bg-muted text-muted-foreground/56",
  frozen: "bg-destructive/14 text-destructive",
  removed: "bg-muted text-muted-foreground/56",
};

export function UsersTable({ users, canRemove }: { users: UserSummary[]; canRemove: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Criado em</TableHead>
            <TableHead className="hidden md:table-cell">Último login</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Link
                  href={`/admin/community/${user.id}`}
                  className="rounded-sm font-medium text-foreground outline-none ui-motion-base hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {user.name ?? "(sem nome)"}
                </Link>
                <p className="text-xs text-muted-foreground/56">{user.email}</p>
              </TableCell>
              <TableCell>
                <Badge className={USER_STATUS_BADGE_CLASS[user.status]} variant="outline">
                  {USER_STATUS_LABEL[user.status]}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {user.createdAt.toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {user.lastLoginAt ? user.lastLoginAt.toLocaleString("pt-BR") : "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                  {user.status === "pending" && (
                    <>
                      <ApproveUserButton userId={user.id} />
                      <RejectUserDialog userId={user.id} />
                    </>
                  )}
                  {user.status === "approved" && <FreezeUserDialog userId={user.id} />}
                  {user.status === "frozen" && <UnfreezeUserButton userId={user.id} />}
                  {canRemove && user.status !== "removed" && <RemoveUserDialog userId={user.id} />}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
