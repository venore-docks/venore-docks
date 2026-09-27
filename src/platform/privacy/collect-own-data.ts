import { getOwnAccountData, type OwnAccountData } from "@/contexts/auth";
import { listOwnAuthoredEntries } from "@/contexts/cms";
import { listOwnMediaAssets } from "@/contexts/media";
import { getUserContext } from "@/contexts/rbac";

export type OwnDataExport = {
  exportedAt: string;
  account: OwnAccountData;
  roles: string[];
  permissions: string[];
  mediaUploaded: unknown[];
  entriesAuthored: unknown[];
  notes: string[];
};

// "Baixar meus dados" (LGPD, art. 18): o que o CORE guarda sobre a pessoa logada, compondo os
// barrels de auth, rbac, cms e media — cada um só devolve os dados da própria sessão. Dados que
// plugins guardam (matrículas, candidaturas...) não entram: cada plugin responde pelos seus.
export async function collectOwnData(): Promise<OwnDataExport | null> {
  const account = await getOwnAccountData();
  if (!account.success) return null;

  const [context, media, entries] = await Promise.all([
    getUserContext({ userId: account.data.id }),
    listOwnMediaAssets(),
    listOwnAuthoredEntries(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: account.data,
    roles: context.success ? context.data.roles.map((role) => role.key) : [],
    permissions: context.success ? context.data.permissions : [],
    mediaUploaded: media.success ? media.data : [],
    entriesAuthored: entries.success ? entries.data : [],
    notes: [
      "Senha e segredo da verificação em duas etapas não são exportados (só se existem).",
      "Dados guardados por plugins deste site não estão incluídos — peça à administração.",
    ],
  };
}
