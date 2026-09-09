import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const productCatalogAmendments = mysqlTable("product_catalog_amendments", {
  id: int("id").autoincrement().primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  fieldName: varchar("fieldName", { length: 64 }).notNull(),
  fieldValue: text("fieldValue").notNull(),
  amendedAt: timestamp("amendedAt").defaultNow().notNull(),
}, table => ({
  brandFieldUnique: uniqueIndex("brand_field_unique").on(table.brandId, table.fieldName),
}));

export type ProductCatalogAmendment = typeof productCatalogAmendments.$inferSelect;
export type InsertProductCatalogAmendment = typeof productCatalogAmendments.$inferInsert;
