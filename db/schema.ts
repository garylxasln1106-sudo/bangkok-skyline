import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Session tokens and client IP addresses are never persisted in plaintext.
export const librarySessions = sqliteTable("library_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("library_sessions_expiry_idx").on(table.expiresAt)]);

export const libraryLoginAttempts = sqliteTable("library_login_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("library_login_attempts_expiry_idx").on(table.expiresAt)]);
