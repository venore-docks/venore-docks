import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";
import { integer, pgSchema, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  // Avatar escolhido via seletor de mídia (contexts/media) — separado de `image` (populado pelo
  // provider OAuth, fora do controle do app). Quando setado, tem prioridade sobre `image` na
  // exibição (get-current-user/service.ts). Sem FK pra media.files: mesma regra de isolamento de
  // schema entre contexts já usada em cms.entries.mediaId — validado via getMedia() na aplicação.
  avatarMediaId: text("avatar_media_id"),
  // "pending" | "approved" | "rejected" | "frozen" | "removed" — ver contracts/types.ts
  // (UserRegistrationStatus). Escrita por provision-user/activate-user/approve-user-registration/
  // reject-user-registration/freeze-user/unfreeze-user/remove-user.
  //
  // Default "pending" (fail-closed): toda conta nasce sem acesso e só vira "approved" por decisão
  // explícita (aprovação, conta criada pelo admin, instalador, setup). Antes o default era
  // "approved" e o registro rebaixava depois — qualquer falha ou corrida no meio deixava a conta
  // aprovada sem ninguém ter aprovado.
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Atualizado no evento signIn do Auth.js (auth.config.ts) — só existe pra alimentar a aba de
  // atividade do perfil admin (/admin/community/[userId]), não é usado por nenhuma checagem de
  // autorização.
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // Versão das sessões (JWT). O token guarda o valor do login; incrementar derruba toda sessão
  // emitida antes ("sair de todos os dispositivos", troca de senha). Ver features/session/
  // revoke-sessions e o callback session de auth.config.ts.
  sessionVersion: integer("session_version").notNull().default(0),
}, (table) => [
  // E-mail único sem diferenciar maiúsculas: o cadastro já normaliza pra minúsculas, mas conta
  // criada pelo adapter do Auth.js (OAuth) grava como o provedor mandou — "Ana@x.com" e
  // "ana@x.com" viravam duas contas. Também atende a busca por e-mail (lower(email) = ...).
  uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
]);

export const accounts = authSchema.table(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = authSchema.table("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = authSchema.table(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (verificationToken) => [
    primaryKey({ columns: [verificationToken.identifier, verificationToken.token] }),
  ],
);
