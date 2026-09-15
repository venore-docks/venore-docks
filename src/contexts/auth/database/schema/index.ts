import type { AdapterAccountType } from "next-auth/adapters";
import { integer, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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
  // (UserRegistrationStatus). Escrita por provision-user/approve-user-registration/
  // reject-user-registration/freeze-user/unfreeze-user/remove-user.
  status: text("status").notNull().default("approved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Atualizado no evento signIn do Auth.js (auth.config.ts) — só existe pra alimentar a aba de
  // atividade do perfil admin (/admin/community/[userId]), não é usado por nenhuma checagem de
  // autorização.
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

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
