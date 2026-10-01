import Link from "next/link";
import { notFound } from "next/navigation";
import { isPasswordResetAvailable } from "@/contexts/auth";
import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  // Sem envio de e-mail configurado a recuperação não existe (e o link some do /login).
  if (!isPasswordResetAvailable()) notFound();
  const sent = (await searchParams).enviado === "1";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6 rounded-panel border border-border bg-card p-8 shadow-panel">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground">Enviamos um link para redefinir a senha.</p>
        </div>

        {sent ? (
          <p role="status" className="text-sm text-muted-foreground">
            Se houver uma conta com esse e-mail, o link chega em alguns minutos. Ele vale por 1 hora — confira também a caixa de spam.
          </p>
        ) : (
          <ForgotPasswordForm />
        )}

        <Link href="/login" className="block text-center text-sm font-medium text-primary">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
