import { listApprovedUserContacts } from "@/contexts/auth";
import { listUserIdsWithPermission } from "@/contexts/rbac";
import { emailPort } from "@/infrastructure/email";
import { getSiteOrigin } from "@/platform/seo/site-origin";

const MAX_RECIPIENTS = 20;
// Mesma permission que libera aprovar/rejeitar em /admin/community.
const APPROVER_PERMISSION = "rbac.users.manage";

// Avisa por e-mail quem pode aprovar que há um cadastro esperando (aprovação exigida). Sem
// provedor de e-mail configurado não faz nada. Nunca lança: o cadastro já foi gravado.
export async function notifyPendingRegistration(user: { email: string | null; name: string | null }): Promise<number> {
  if (!emailPort.isEnabled()) return 0;
  try {
    const recipients = (await listApprovedUserContacts(await listUserIdsWithPermission(APPROVER_PERMISSION))).slice(0, MAX_RECIPIENTS);
    if (recipients.length === 0) return 0;

    let origin = process.env.SITE_URL ?? "";
    try {
      origin = await getSiteOrigin();
    } catch {
      // fora de request (evento do Auth.js em alguns caminhos) — sem link absoluto
    }
    const who = user.name ? `${user.name} (${user.email ?? "sem e-mail"})` : (user.email ?? "Uma nova pessoa");
    const results = await Promise.all(
      recipients.map((recipient) =>
        emailPort.send({
          to: recipient.email,
          subject: "Novo cadastro aguardando aprovação",
          text: `${who} se cadastrou e está aguardando aprovação.\n\nRevise em: ${origin}/admin/community`,
        }),
      ),
    );
    return results.filter((result) => result.sent).length;
  } catch (error) {
    console.warn("[registration] aviso de cadastro pendente falhou.", error);
    return 0;
  }
}
