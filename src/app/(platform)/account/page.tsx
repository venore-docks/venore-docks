import { redirect } from "next/navigation";
import { getCurrentUser, getOwnAccountData, getOwnMfaStatus } from "@/contexts/auth";
import { getMediaAsset } from "@/contexts/media";
import type { AccountTemplateProps } from "@/contexts/themes/contracts/v8";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { renderTemplate, resolveTemplateContext, resolveTemplateVariant } from "@/platform/theme-rendering/render-template";
import { AvatarForm } from "./_components/avatar-form";
import { NameForm } from "./_components/name-form";
import { ChangePasswordForm, RevokeSessionsForm } from "./_components/security-forms";
import { DisableMfa, EnableMfa } from "./_components/mfa-forms";
import { DeleteAccountForm } from "./_components/privacy-forms";

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
  const [mfaResult, accountData] = await Promise.all([getOwnMfaStatus(), getOwnAccountData()]);
  const mfa = mfaResult.success ? mfaResult.data : null;
  // A conta tem senha (independe de como esta sessão entrou): define se os formulários pedem a senha.
  const hasPassword = accountData.success ? accountData.data.hasPassword : user.authProvider === "credentials";
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

  const context = await resolveTemplateContext();
  const props: AccountTemplateProps = {
    ...context.common,
    title: "Minha conta",
    subtitle: user.name ?? user.email,
    jsonLd: null,
    outlets: { before: null, after: null },
    sections: (
      <>
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
            <ChangePasswordForm hasPasswordLogin={hasPassword} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Verificação em duas etapas</CardTitle>
          </CardHeader>
          <CardContent>{mfa?.enabled ? <DisableMfa recoveryCodesLeft={mfa.recoveryCodesLeft} /> : <EnableMfa />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sessões</CardTitle>
          </CardHeader>
          <CardContent>
            <RevokeSessionsForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Privacidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Baixe os dados que este site guarda sobre você (perfil, papéis, arquivos e conteúdos).
              </p>
              <a href="/api/account/export" className="text-sm font-medium text-primary hover:underline" download>
                Baixar meus dados (JSON)
              </a>
            </div>
            <DeleteAccountForm hasPasswordLogin={hasPassword} />
          </CardContent>
        </Card>
      </>
    ),
  };

  // Formulários de conta são do core (ações com autorização própria); o tema só desenha a moldura.
  return renderTemplate(context.theme, "account", props, {
    variant: resolveTemplateVariant("account", { section: context.section }),
  });
}
