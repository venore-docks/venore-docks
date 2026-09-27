import { redirect } from "next/navigation";
import { getCurrentUser } from "@/contexts/auth";
import { getMediaAsset } from "@/contexts/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarForm } from "./_components/avatar-form";
import { NameForm } from "./_components/name-form";
import { ChangePasswordForm, RevokeSessionsForm } from "./_components/security-forms";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "senha-alterada": "Senha alterada. As outras sessões desta conta foram encerradas.",
  "sessoes-encerradas": "As outras sessões foram encerradas.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const notice = NOTICES[(await searchParams).aviso ?? ""] ?? null;
  const currentUser = await getCurrentUser();

  if (!currentUser.success || !currentUser.data) {
    redirect("/login?callbackUrl=%2Faccount");
  }

  const user = currentUser.data;
  const avatarMediaResult = user.avatarMediaId ? await getMediaAsset({ id: user.avatarMediaId }) : null;
  const avatarMedia =
    avatarMediaResult?.success && avatarMediaResult.data
      ? {
          id: avatarMediaResult.data.id,
          filename: avatarMediaResult.data.filename,
          url: avatarMediaResult.data.url,
          contentType: avatarMediaResult.data.contentType,
        }
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Minha conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">{user.name ?? user.email}</p>
      </div>

      {notice && (
        <p role="status" className="rounded-md border border-border bg-accent/14 px-3 py-2 text-sm text-foreground">
          {notice}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nome</CardTitle>
        </CardHeader>
        <CardContent>
          <NameForm name={user.name} editable={user.authProvider === "credentials"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Avatar</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarForm avatarMedia={avatarMedia} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm hasPasswordLogin={user.authProvider === "credentials"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sessões</CardTitle>
        </CardHeader>
        <CardContent>
          <RevokeSessionsForm />
        </CardContent>
      </Card>
    </div>
  );
}
