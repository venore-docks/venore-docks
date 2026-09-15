import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { searchUsers } from "@/contexts/auth";
import { getUserContext } from "@/contexts/rbac";
import { listAuditEvents } from "@/observability";
import { getCommunityPageData } from "@/platform/admin-shell/get-community-page-data";
import { AdminAccessDenied } from "@/components/admin-access-denied";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ApproveUserButton } from "../_components/approve-user-button";
import { FreezeUserDialog } from "../_components/freeze-user-dialog";
import { PurgeUserDialog } from "../_components/purge-user-dialog";
import { RejectUserDialog } from "../_components/reject-user-dialog";
import { RemoveUserDialog } from "../_components/remove-user-dialog";
import { UnfreezeUserButton } from "../_components/unfreeze-user-button";
import { USER_STATUS_BADGE_CLASS, USER_STATUS_LABEL } from "../_components/users-table";
import { ResetPasswordDialog } from "./_components/reset-password-dialog";

export default async function CommunityUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const gate = await getCommunityPageData();

  if (!gate.granted) {
    return <AdminAccessDenied message="Você não tem permissão para ver contas da comunidade." />;
  }

  const { userId } = await params;
  const canManage = gate.actor.isSuperadmin || gate.actor.permissions.includes("rbac.users.manage");
  const canRemove = gate.actor.isSuperadmin || gate.actor.permissions.includes("rbac.users.remove");
  const canPurge = gate.actor.isSuperadmin || gate.actor.permissions.includes("rbac.users.purge");
  const canViewActivity = gate.actor.isSuperadmin || gate.actor.permissions.includes("observability.audit.view");

  const [userResult, contextResult] = await Promise.all([
    searchUsers({ id: userId, limit: 1 }),
    getUserContext({ userId }),
  ]);

  if (!userResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar o usuário agora. Tente recarregar a página.</p>;
  }

  const user = userResult.data.entries[0];
  if (!user) {
    return <AdminAccessDenied title="Usuário não encontrado" message="Esse id não corresponde a nenhuma conta." />;
  }

  const roles = contextResult.success ? contextResult.data.roles : [];

  const activity = canViewActivity ? await listAuditEvents({ targetUserId: userId }) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/community"
          className="-ml-2 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm text-muted-foreground outline-none ui-motion-base hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" /> Comunidade
        </Link>
      </div>

      <AdminPageHeader
        title={user.name ?? "(sem nome)"}
        description={user.email}
        actions={canManage ? <ResetPasswordDialog userId={user.id} /> : undefined}
      />

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <Badge className={USER_STATUS_BADGE_CLASS[user.status]} variant="outline">
              {USER_STATUS_LABEL[user.status]}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Criado em</p>
            <p className="text-sm text-foreground">{user.createdAt.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Último login</p>
            <p className="text-sm text-foreground">{user.lastLoginAt ? user.lastLoginAt.toLocaleString("pt-BR") : "Nunca"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Papéis</p>
            <div className="flex flex-wrap gap-1">
              {roles.length > 0 ? (
                roles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4">
          {user.status === "pending" && (
            <>
              <ApproveUserButton userId={user.id} />
              <RejectUserDialog userId={user.id} />
            </>
          )}
          {user.status === "approved" && <FreezeUserDialog userId={user.id} />}
          {user.status === "frozen" && <UnfreezeUserButton userId={user.id} />}
          {canRemove && user.status !== "removed" && <RemoveUserDialog userId={user.id} />}
          {canPurge && user.status === "removed" && <PurgeUserDialog userId={user.id} />}
        </div>
      </section>

      {canViewActivity && (
        <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
          <h2 className="text-sm font-semibold text-foreground">Atividade</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ações administrativas privilegiadas sobre esta conta.</p>

          {!activity?.success ? (
            <p className="mt-4 text-sm text-destructive">Não foi possível carregar a atividade agora.</p>
          ) : activity.data.entries.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={<SearchX className="size-8" strokeWidth={1.5} />}
              title="Nenhuma atividade registrada"
              description="Aprovação, rejeição, congelamento, remoção e reset de senha aparecem aqui."
            />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {activity.data.entries.map((entry) => (
                <li key={entry.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/56">
                    <span className="whitespace-nowrap">{entry.occurredAt.toLocaleString("pt-BR")}</span>
                    <Badge variant={entry.outcome === "success" ? "secondary" : "destructive"}>
                      {entry.outcome === "success" ? "sucesso" : "falha"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{entry.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
