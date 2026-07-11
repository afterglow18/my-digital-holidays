import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  app: text("app").notNull().default("vanity"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_email_app_unique").on(t.email, t.app),
]);

export type User = typeof usersTable.$inferSelect;
