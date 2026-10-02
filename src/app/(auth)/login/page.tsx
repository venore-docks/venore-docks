import Link from "next/link";
import { isPasswordResetAvailable, listAvailableAuthProviders } from "@/contexts/auth";
import { superadminExists } from "@/contexts/rbac";
import { toSafeCallbackUrl } from "@/platform/auth-flow/safe-callback-url";
import { isSelfRegistrationEnabled } from "@/platform/registration/registration-settings";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { resolveBrandAesthetics } from "@/platform/theme-rendering/resolve-brand-aesthetics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithPasswordAction, signInWithProviderAction, signUpWithPasswordAction } from "../actions";
import { PasswordInput } from "@/components/password-input";
import { renderTemplate, resolveTemplateContext, resolveTemplateVariant } from "@/platform/theme-rendering/render-template";

// Só mensagens conhecidas, por código — antes `?error=` aceitava texto livre e qualquer um montava
// um link de login oficial com a mensagem que quisesse (content spoofing).
const ERROR_MESSAGES: Record<string, string> = {
  "invalid-credentials": "Usuário ou senha inválidos.",
  "too-many-attempts": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "registration-closed": "O cadastro de novas contas está fechado neste site. Fale com um administrador.",
  account_pending: "Cadastro aguardando aprovação de um administrador.",
  account_rejected: "Cadastro rejeitado. Fale com um administrador se acha que isso é engano.",
  account_frozen: "Conta congelada por um administrador. Fale com um administrador para reativar.",
  account_removed: "Conta removida.",
  mfa_required: "Esta conta usa verificação em duas etapas: informe também o código do app autenticador.",
  mfa_invalid: "Código de verificação inválido. Use o código atual do app ou um código de recuperação.",
  "auth.registration.invalid_email": "Informe um email válido.",
  "auth.registration.invalid_name": "Informe seu nome.",
  "auth.registration.weak_password": "A senha precisa ter ao menos 8 caracteres.",
  "auth.registration.password_disabled": "O cadastro com senha não está habilitado neste site.",
  // Erros que o Auth.js devolve na própria URL (?error=...) quando o login OAuth falha.
  OAuthAccountNotLinked: "Este e-mail já tem uma conta com outra forma de login. Entre pelo método que você usou antes.",
  AccessDenied: "Acesso negado.",
  Configuration: "Login temporariamente indisponível. Tente de novo em instantes.",
};

const NOTICE_MESSAGES: Record<string, string> = {
  "registration-received": "Cadastro recebido. Se ele for aprovado por um administrador, você poderá entrar com seu e-mail e senha.",
  "password-reset": "Senha redefinida. Entre com a nova senha.",
  "invitation-accepted": "Conta criada. Entre com seu e-mail e a senha que você escolheu.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; callbackUrl?: string }>;
}) {
  const { error, notice, callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = toSafeCallbackUrl(rawCallbackUrl);
  const providers = listAvailableAuthProviders();
  const oauthProviders = providers.filter((provider) => provider.kind === "oauth" && provider.enabled);
  const passwordProvider = providers.find((provider) => provider.kind === "password" && provider.enabled);

  const superadminExistsResult = await superadminExists();
  const showBootstrapNotice = superadminExistsResult.success && !superadminExistsResult.data;
  const selfRegistrationEnabled = await isSelfRegistrationEnabled();

  const aesthetics = await resolveBrandAesthetics();
  const brand = await getBrandConfig(aesthetics.mode);

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Não foi possível entrar. Tente de novo.") : null;
  const noticeMessage = notice ? (NOTICE_MESSAGES[notice] ?? null) : null;

  const context = await resolveTemplateContext();
  const form = (
    <>
      {showBootstrapNotice ? (
        <p className="rounded-control border border-border bg-accent/14 px-3 py-2 text-xs text-foreground">
          Configuração inicial pendente.{" "}
          <Link href="/setup" className="underline">
            Concluir configuração
          </Link>
        </p>
      ) : null}

      {noticeMessage ? (
        <p className="rounded-control border border-border bg-accent/14 px-3 py-2 text-xs text-foreground">{noticeMessage}</p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorMessage}</p>
      ) : null}

      <div className="space-y-2">
        {oauthProviders.map((provider) => (
          <form key={provider.key} action={signInWithProviderAction}>
            <input type="hidden" name="provider" value={provider.key} />
            {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
            <Button type="submit" variant="outline" className="w-full gap-2">
              {provider.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={provider.iconUrl} alt="" aria-hidden="true" className="h-4 w-4" />
              ) : null}
              Entrar com {provider.label}
            </Button>
          </form>
        ))}
      </div>

      {passwordProvider ? (
        <form action={signInWithPasswordAction} className="space-y-2">
          {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
          <div className="space-y-2">
            <Input name="username" placeholder="Email ou usuário" autoComplete="username" required />
            <PasswordInput name="password" placeholder="Senha" autoComplete="current-password" required />
            <Input
              name="otp"
              placeholder="Código de verificação (se ativado)"
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={12}
            />
          </div>
          <Button type="submit" className="w-full">
            Entrar com senha
          </Button>
          {isPasswordResetAvailable() ? (
            <Link href="/forgot-password" className="block text-center text-xs font-medium text-primary">
              Esqueci minha senha
            </Link>
          ) : null}
        </form>
      ) : null}

      {passwordProvider && selfRegistrationEnabled ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Criar conta</summary>
          <form action={signUpWithPasswordAction} className="mt-3 space-y-2">
            <Input name="name" placeholder="Nome" autoComplete="name" required />
            <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
            <PasswordInput name="password" placeholder="Senha (mín. 8 caracteres)" autoComplete="new-password" required minLength={8} />
            <Button type="submit" variant="outline" className="w-full">
              Criar conta
            </Button>
            <p className="text-xs text-muted-foreground">O acesso fica pendente até um administrador aprovar.</p>
          </form>
        </details>
      ) : null}
    </>
  );

  // Moldura (cartão, marca, título) é o template "login" do tema; o formulário e as mensagens
  // continuam do core — ações com autorização e rate limit próprios.
  return renderTemplate(
    context.theme,
    "login",
    {
      ...context.common,
      brand: {
        name: brand.siteName,
        mode: aesthetics.mode,
        size: aesthetics.size,
        scrolledSize: aesthetics.scrolledSize,
        position: aesthetics.position,
        logoUrl: brand.logoUrl,
        scrolledLogoUrl: brand.scrolledLogoUrl,
      },
      form,
      footer: null,
      jsonLd: null,
      outlets: { before: null, after: null },
    },
    { variant: resolveTemplateVariant("login", { section: context.section }) },
  );
}
