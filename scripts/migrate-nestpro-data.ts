import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { accounts as authAccounts, users as authUsers } from "@/contexts/auth/database/schema";
import {
  discInstances,
  discReports,
  discTeamMembers,
  discTeams,
} from "@venore/plugin-disc/database/schema";

// Migração ÚNICA da base de produção do NestPro (nestpro/db/schema.ts) para o schema novo do
// plugin @venore/plugin-disc. Não roda como parte do install do plugin (run-plugin-migrations.ts)
// — é uma ferramenta operacional de site, de uso único, por isso mora em scripts/ do core (só o
// core pode importar @/contexts/auth/database/schema direto; um plugin nunca pode).
//
// Uso:
//   tsx --env-file=.env scripts/migrate-nestpro-data.ts                  (dry-run, não escreve nada)
//   tsx --env-file=.env scripts/migrate-nestpro-data.ts --apply          (aplica de verdade)
//
// Requer NESTPRO_SOURCE_DATABASE_URL apontando para o Postgres de produção do NestPro (conexão só
// de leitura — este script nunca escreve na base de origem) e DATABASE_URL apontando para o
// Postgres desta instância do Docks (destino).
//
// Estratégia de identidade (decisão do usuário, 2026-09-15): auto-vincular por email. Pra cada
// usuário do NestPro citado em team/teammembers/assessmentsreports, procura um auth.users com o
// mesmo email no destino; se não existir, CRIA um (mesmo id do NestPro, pra manter os UUIDs
// referenciados por team/instance/report intactos) e replica as linhas de auth.accounts (Google/
// Microsoft) do NestPro, remapeando o provider "azure-ad" -> "microsoft-entra-id" (o Docks usa
// next-auth/providers/microsoft-entra-id, não azure-ad) — o providerAccountId (sub/oid do
// provedor) é o mesmo independente do nome do provider no next-auth, então o próximo login OAuth
// da pessoa casa direto com a conta migrada, sem exigir nenhuma ação manual dela.
//
// Teams/instances/reports mantêm os UUIDs originais do NestPro como id novo — links já
// compartilhados (/reports/r/<uuid>) continuam válidos após o corte de DNS.

const APPLY = process.argv.includes("--apply");

type SourceUser = { id: string; email: string; name: string | null };
type SourceAccount = { userId: string; type: string; provider: string; providerAccountId: string };
type SourceTeam = { teamid: string; ownerid: string | null; teamname: string | null; description: string | null; created: Date };
type SourceTeamMember = { id: string; teamid: string | null; userid: string | null; role: string | null; created: Date };
type SourceEnviroment = { enviromentid: string; name: string | null };
type SourceInstance = { instanceid: string; teamid: string | null; enviromentid: string | null; created: Date };
type SourceReport = {
  reportid: string;
  userid: string | null;
  teamid: string | null;
  enviromentid: string | null;
  instanceid: string | null;
  dataset: unknown;
  created: Date;
};

const PROVIDER_REMAP: Record<string, string> = { "azure-ad": "microsoft-entra-id" };

function readDatasetProfile(dataset: unknown, side: "more" | "less"): string {
  const value = (dataset as Record<string, { profile?: unknown }> | null)?.[side]?.profile;
  return typeof value === "string" ? value : "";
}

function readDatasetStress(dataset: unknown): string {
  const value = (dataset as { stress?: unknown } | null)?.stress;
  return value === undefined || value === null ? "" : String(value);
}

// Slug curto de convite pro histórico migrado — instâncias do NestPro nunca tiveram link curto,
// então geramos um novo aqui (não afeta o id da instância, só o campo de compartilhamento).
function generateShortSlug(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(2)))
    .map((value) => value.toString(36))
    .join("")
    .slice(0, 8);
}

async function main() {
  const sourceUrl = process.env.NESTPRO_SOURCE_DATABASE_URL;
  if (!sourceUrl) {
    console.error("\n✖ NESTPRO_SOURCE_DATABASE_URL não está definida (aponte para o Postgres de produção do NestPro).");
    process.exit(1);
  }

  console.log(APPLY ? "\n⚠ Rodando em modo APLICAR — isto vai escrever no banco de destino.\n" : "\n(dry-run — nada será escrito; rode com --apply para aplicar de verdade)\n");

  const source = new Pool({ connectionString: sourceUrl, max: 2 });

  try {
    const counts = { usersLinked: 0, usersCreated: 0, teams: 0, teamMembers: 0, instances: 0, reports: 0, skippedReports: 0 };

    console.log("[1/5] Lendo usuários citados em teams/teammembers/reports…");
    const { rows: sourceTeams } = await source.query<SourceTeam>('SELECT teamid, ownerid, teamname, description, created FROM "team"');
    const { rows: sourceMembers } = await source.query<SourceTeamMember>('SELECT id, teamid, userid, role, created FROM "teammembers"');
    const { rows: sourceReports } = await source.query<SourceReport>(
      'SELECT reportid, userid, teamid, enviromentid, instanceid, dataset, created FROM "assessmentsreports"',
    );
    const { rows: sourceInstances } = await source.query<SourceInstance>('SELECT instanceid, teamid, enviromentid, created FROM "instance"');
    const { rows: sourceEnviroments } = await source.query<SourceEnviroment>('SELECT enviromentid, name FROM "enviroment"');
    const enviromentNameById = new Map(sourceEnviroments.map((row) => [row.enviromentid, row.name ?? "Geral"]));

    const referencedUserIds = new Set<string>();
    for (const team of sourceTeams) if (team.ownerid) referencedUserIds.add(team.ownerid);
    for (const member of sourceMembers) if (member.userid) referencedUserIds.add(member.userid);
    for (const report of sourceReports) if (report.userid) referencedUserIds.add(report.userid);

    const { rows: sourceUsers } = referencedUserIds.size
      ? await source.query<SourceUser>(
          `SELECT id, email, name FROM "user" WHERE id = ANY($1::text[])`,
          [Array.from(referencedUserIds)],
        )
      : { rows: [] as SourceUser[] };
    const { rows: sourceAccounts } = referencedUserIds.size
      ? await source.query<SourceAccount>(
          `SELECT "userId", type, provider, "providerAccountId" FROM "account" WHERE "userId" = ANY($1::text[])`,
          [Array.from(referencedUserIds)],
        )
      : { rows: [] as SourceAccount[] };
    const accountsByUserId = new Map<string, SourceAccount[]>();
    for (const account of sourceAccounts) {
      const list = accountsByUserId.get(account.userId) ?? [];
      list.push(account);
      accountsByUserId.set(account.userId, list);
    }

    console.log(`      ${sourceUsers.length} usuário(s), ${sourceTeams.length} time(s), ${sourceMembers.length} membro(s), ${sourceInstances.length} instância(s), ${sourceReports.length} relatório(s).`);

    console.log("\n[2/5] Vinculando usuários por email (cria conta quando não existe)…");
    for (const sourceUser of sourceUsers) {
      const [existing] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, sourceUser.email));

      if (existing) {
        counts.usersLinked++;
        continue;
      }

      counts.usersCreated++;
      if (APPLY) {
        await db.insert(authUsers).values({
          id: sourceUser.id,
          email: sourceUser.email,
          name: sourceUser.name,
          status: "approved",
        });

        const linkedAccounts = accountsByUserId.get(sourceUser.id) ?? [];
        for (const account of linkedAccounts) {
          const provider = PROVIDER_REMAP[account.provider] ?? account.provider;
          await db
            .insert(authAccounts)
            .values({
              userId: sourceUser.id,
              type: account.type as "oauth",
              provider,
              providerAccountId: account.providerAccountId,
            })
            .onConflictDoNothing();
        }
      }
    }

    console.log("\n[3/5] Migrando equipes…");
    for (const team of sourceTeams) {
      if (!team.ownerid) continue; // time sem dono no NestPro — não deveria existir, pulado com segurança
      counts.teams++;
      if (APPLY) {
        await db
          .insert(discTeams)
          .values({
            id: team.teamid,
            ownerUserId: team.ownerid,
            name: team.teamname ?? "Equipe sem nome",
            description: team.description,
            createdAt: team.created,
          })
          .onConflictDoNothing();
      }
    }

    for (const member of sourceMembers) {
      if (!member.teamid || !member.userid) continue;
      counts.teamMembers++;
      if (APPLY) {
        await db
          .insert(discTeamMembers)
          .values({
            id: member.id,
            teamId: member.teamid,
            userId: member.userid,
            // NestPro guardava papel como texto livre ("Administrador", etc.) — só o dono da
            // equipe original vira "admin" aqui; o resto entra como "member" (o novo modelo não
            // tem papéis intermediários, ver contracts/types.ts DiscTeamMemberRole).
            role: sourceTeams.some((t) => t.teamid === member.teamid && t.ownerid === member.userid) ? "admin" : "member",
            createdAt: member.created,
          })
          .onConflictDoNothing();
      }
    }

    console.log("\n[4/5] Migrando instâncias…");
    const environmentByInstanceId = new Map<string, string>();
    for (const instance of sourceInstances) {
      const environmentLabel = instance.enviromentid ? enviromentNameById.get(instance.enviromentid) ?? "Geral" : "Geral";
      environmentByInstanceId.set(instance.instanceid, environmentLabel);
      counts.instances++;
      if (APPLY) {
        await db
          .insert(discInstances)
          .values({
            id: instance.instanceid,
            teamId: instance.teamid,
            environmentLabel,
            shareSlug: generateShortSlug(),
            createdByUserId: instance.teamid
              ? sourceTeams.find((t) => t.teamid === instance.teamid)?.ownerid ?? "unknown"
              : "unknown",
            createdAt: instance.created,
          })
          .onConflictDoNothing();
      }
    }

    console.log("\n[5/5] Migrando relatórios…");
    for (const report of sourceReports) {
      const profileKey = readDatasetProfile(report.dataset, "more");
      const profileKeySecondary = readDatasetProfile(report.dataset, "less");
      if (!profileKey || !profileKeySecondary) {
        // dataset vazio/corrompido (ex: teste nunca concluído) — sem profile não dá pra exibir
        // relatório nenhum, pulado em vez de gravar lixo.
        counts.skippedReports++;
        continue;
      }

      const environmentLabel = report.instanceid
        ? environmentByInstanceId.get(report.instanceid) ?? "Geral"
        : report.enviromentid
          ? enviromentNameById.get(report.enviromentid) ?? "Geral"
          : "Geral";

      counts.reports++;
      if (APPLY) {
        await db
          .insert(discReports)
          .values({
            id: report.reportid,
            userId: report.userid,
            instanceId: report.instanceid,
            environmentLabel,
            dataset: report.dataset,
            profileKey,
            profileKeySecondary,
            stress: readDatasetStress(report.dataset),
            createdAt: report.created,
          })
          .onConflictDoNothing();
      }
    }

    console.log("\n— Resumo —");
    console.log(`  Usuários já existentes vinculados por email: ${counts.usersLinked}`);
    console.log(`  Usuários novos criados:                      ${counts.usersCreated}`);
    console.log(`  Equipes:                                     ${counts.teams}`);
    console.log(`  Membros de equipe:                           ${counts.teamMembers}`);
    console.log(`  Instâncias:                                  ${counts.instances}`);
    console.log(`  Relatórios migrados:                         ${counts.reports}`);
    console.log(`  Relatórios pulados (dataset incompleto):     ${counts.skippedReports}`);
    console.log(
      APPLY
        ? "\n✓ Migração aplicada. Confira os números acima contra a base de origem antes de considerar concluído."
        : "\nDry-run concluído — nada foi escrito. Rode de novo com --apply quando os números acima baterem com o esperado.",
    );
  } finally {
    await source.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
