import Link from "next/link";
import { notFound } from "next/navigation";
import { isPasswordResetAvailable } from "@/contexts/auth";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (!isPasswordResetAvailable()) notFound();
  const token = (await searchParams).token ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6 rounded-panel border border-border bg-card p-8 shadow-panel">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Nova senha</h1>
          <p className="text-sm text-muted-foreground">Escolha a nova senha da sua conta.</p>
        </div>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-muted-foreground">Link incompleto. Abra o link do e-mail de novo ou peça outro.</p>
        )}

        <Link href="/forgot-password" className="block text-center text-sm font-medium text-primary">
          Pedir um novo link
        </Link>
      </div>
    </main>
  );
}
