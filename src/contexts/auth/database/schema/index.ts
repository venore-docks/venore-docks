import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";
import { index, integer, pgSchema, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
  // Verificação em duas etapas (TOTP) do login por senha — features/mfa. Segredos cifrados
  // (shared/secret-box.ts). pending = cadastro iniciado e ainda não confirmado com um código.
  mfaSecret: text("mfa_secret"),
  mfaPendingSecret: text("mfa_pending_secret"),
  mfaEnabledAt: timestamp("mfa_enabled_at", { withTimezone: true }),
  // Último passo TOTP aceito: o mesmo código não vale duas vezes (replay dentro dos 30 s).
  mfaLastStep: integer("mfa_last_step"),
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

// Recuperação de senha por e-mail (features/identity/request-password-reset e
// reset-password-with-token). Só o sha256 do token fica no banco; o token vai no link do e-mail.
// Uso único (used_at) e validade curta (expires_at).
export const passwordResetTokens = authSchema.table(
  "password_reset_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("password_reset_tokens_user_idx").on(table.userId), index("password_reset_tokens_expires_idx").on(table.expiresAt)],
);

// Códigos de recuperação da verificação em duas etapas (uso único, só o hash).
export const mfaRecoveryCodes = authSchema.table(
  "mfa_recovery_codes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull().unique(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [index("mfa_recovery_codes_user_idx").on(table.userId)],
);

// Convites (features/invitations): link de uso único que cria uma conta já aprovada com um papel.
// role_id/invited_by sem FK pro rbac (isolamento de schema, mesmo caso de avatar_media_id).
export const invitations = authSchema.table(
  "invitations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    roleId: text("role_id").notNull(),
    invitedBy: text("invited_by").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("invitations_email_idx").on(table.email)],
);
