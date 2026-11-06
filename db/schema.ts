import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  state: text("state").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull()
});

export const roomOwners = sqliteTable("room_owners", {
  ownerKey: text("owner_key").primaryKey(),
  activeCode: text("active_code").notNull(),
  updatedAt: integer("updated_at").notNull()
});
