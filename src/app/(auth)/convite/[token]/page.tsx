import type { Metadata } from "next";
import Link from "next/link";
import { previewInvitation } from "@/platform/registration/invitations";
import { AcceptInvitationForm } from "./accept-invitation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Convite", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await params).token);
  const invitation = await previewInvitation(token);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6 rounded-panel border border-border bg-card p-8 shadow-panel">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Criar conta</h1>
          {invitation.success && <p className="text-sm text-muted-foreground">Convite para {invitation.data.email}</p>}
        </div>
        {invitation.success ? (
          <AcceptInvitationForm token={token} />
        ) : (
          <p className="text-sm text-muted-foreground">Este convite é inválido, expirou ou já foi usado. Peça um novo a quem convidou você.</p>
        )}
        <Link href="/login" className="block text-center text-sm font-medium text-primary">
          Já tenho conta
        </Link>
      </div>
    </main>
  );
}
