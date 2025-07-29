import { pgTable, text, serial, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  badgeNumber: text("badge_number").notNull(),
  isAdmin: text("is_admin").default("false").notNull(),
  rpName: text("rp_name"),
  rank: text("rank"),
  discordId: text("discord_id"),
});

export const deletedUsernames = pgTable("deleted_usernames", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
});

export const citations = pgTable("citations", {
  id: serial("id").primaryKey(),
  officerBadges: text("officer_badges").array().notNull(),
  officerUsernames: text("officer_usernames").array().notNull(),
  officerRanks: text("officer_ranks").array().notNull(),
  officerUserIds: text("officer_user_ids").array().notNull(),
  violatorUsername: text("violator_username").notNull(),
  violatorSignature: text("violator_signature").notNull(),
  violationType: text("violation_type").notNull(),
  penalCodes: text("penal_codes").array().notNull(),
  amountsDue: text("amounts_due").array().notNull(),
  jailTimes: text("jail_times").array(),
  totalAmount: text("total_amount").notNull(),
  totalJailTime: text("total_jail_time"),
  additionalNotes: text("additional_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  badgeNumber: true,
  isAdmin: true,
  rpName: true,
  rank: true,
  discordId: true,
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  rpName: true,
  rank: true,
  discordId: true,
  badgeNumber: true,
});

export const insertCitationSchema = createInsertSchema(citations).omit({
  id: true,
  createdAt: true,
}).extend({
  // Officer data as arrays
  officerBadges: z.array(z.string().min(1, "Badge number is required")).min(1, "At least one officer badge is required"),
  officerUsernames: z.array(z.string().min(1, "Officer username is required")).min(1, "At least one officer username is required"),
  officerRanks: z.array(z.string().min(1, "Officer rank is required")).min(1, "At least one officer rank is required"),
  officerUserIds: z.array(z.string().min(1, "Officer Discord User ID is required")).min(1, "At least one officer Discord User ID is required"),

  // Penal code data as arrays
  penalCodes: z.array(z.string().min(1, "Penal code is required")),
  amountsDue: z.array(z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")),
  jailTimes: z.array(z.string()).optional().default([]),
  totalJailTime: z.string().optional().default("0 Seconds"),

  // Single values
  violatorUsername: z.string().min(1, "Violator username is required"),
  violatorSignature: z.string().min(1, "Violator signature is required"),
  violationType: z.string().default("Citation"),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid total amount format"),
  additionalNotes: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCitation = z.infer<typeof insertCitationSchema>;
export type Citation = typeof citations.$inferSelect;