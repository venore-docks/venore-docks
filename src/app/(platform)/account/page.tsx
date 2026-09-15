import { redirect } from "next/navigation";
import { getCurrentUser } from "@/contexts/auth";
import { getMediaAsset } from "@/contexts/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarForm } from "./_components/avatar-form";
import { NameForm } from "./_components/name-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser.success || !currentUser.data) {
    redirect("/api/auth/signin");
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
    </div>
  );
}
