import { eq, sql } from "drizzle-orm";
import { db, users, citations, arrests, deletedUsernames, terminatedUsernames } from "./db";
import { type User, type InsertUser, type Citation, type InsertCitation } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, profile: { rpName?: string; rank?: string; discordId?: string; badgeNumber?: string }): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  getCitation(id: number): Promise<Citation | undefined>;
  createCitation(citation: InsertCitation): Promise<Citation>;
  getAllCitations(): Promise<Citation[]>;
  deleteCitation(id: string): Promise<void>;
  deleteAllCitations(): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  updateUserAdmin(id: number, isAdmin: boolean): Promise<void>;
  deleteArrest(id: string): Promise<void>;
  deleteAllArrests(): Promise<void>;
  getAllArrests(): Promise<any[]>;
  saveArrest(arrest: any): Promise<any>;
  isUsernameBlocked(username: string): Promise<boolean>;
  blockUsername(username: string): Promise<void>;
  unblockUsername(username: string): Promise<void>;
  getBlockedUsernames(): Promise<Array<{ id: number; username: string; deletedAt: Date }>>;
  terminateUsername(username: string): Promise<void>;
  unterminateUsername(username: string): Promise<void>;
  getTerminatedUsernames(): Promise<Array<{ id: number; username: string; terminatedAt: Date }>>;
  isUsernameTerminated(username: string): Promise<boolean>;
  getCitationCount(): Promise<number>;
  getArrestCount(): Promise<number>;
  updateUserRank(userId: number, rank: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private adminUsernames = ['popfork1', 'admin', 'administrator'];

  private isAdminUsername(username: string): boolean {
    return this.adminUsernames.some(a => a.toLowerCase() === username.toLowerCase());
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      sql`lower(${users.username}) = lower(${username})`
    );
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const isAdmin = this.isAdminUsername(insertUser.username || '') ? "true" : "false";
    const [user] = await db.insert(users).values({
      ...insertUser,
      isAdmin,
    }).returning();
    return user;
  }

  async updateUserProfile(id: number, profile: { rpName?: string; rank?: string; discordId?: string; badgeNumber?: string }): Promise<User | undefined> {
    const updates: Partial<User> = {};
    if (profile.rpName !== undefined) updates.rpName = profile.rpName || null;
    if (profile.rank !== undefined) updates.rank = profile.rank || null;
    if (profile.discordId !== undefined) updates.discordId = profile.discordId || null;
    if (profile.badgeNumber !== undefined) updates.badgeNumber = profile.badgeNumber;

    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async updateUserAdmin(id: number, isAdmin: boolean): Promise<void> {
    await db.update(users).set({ isAdmin: isAdmin ? "true" : "false" }).where(eq(users.id, id));
  }

  async updateUserRank(userId: number, rank: string): Promise<void> {
    await db.update(users).set({ rank }).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      await this.blockUsername(user.username);
      await db.delete(users).where(eq(users.id, id));
    }
  }

  async getCitation(id: number): Promise<Citation | undefined> {
    const [citation] = await db.select().from(citations).where(eq(citations.id, id.toString()));
    return citation;
  }

  async createCitation(insertCitation: InsertCitation): Promise<Citation> {
    const { nanoid } = await import("nanoid");
    const [citation] = await db.insert(citations).values({
      id: (insertCitation as any).id || nanoid(),
      officerBadges: insertCitation.officerBadges,
      officerUsernames: insertCitation.officerUsernames,
      officerRanks: insertCitation.officerRanks,
      officerUserIds: insertCitation.officerUserIds,
      violatorUsername: insertCitation.violatorUsername,
      violatorSignature: insertCitation.violatorSignature,
      violationType: insertCitation.violationType || "Citation",
      penalCodes: insertCitation.penalCodes,
      amountsDue: insertCitation.amountsDue,
      jailTimes: insertCitation.jailTimes || [],
      totalAmount: insertCitation.totalAmount,
      totalJailTime: insertCitation.totalJailTime || "0 Seconds",
      additionalNotes: insertCitation.additionalNotes || null,
      issuedBy: (insertCitation as any).issuedBy,
    }).returning();
    return citation;
  }

  async getAllCitations(): Promise<Citation[]> {
    return db.select().from(citations);
  }

  async deleteCitation(id: string): Promise<void> {
    await db.delete(citations).where(eq(citations.id, id));
  }

  async deleteAllCitations(): Promise<void> {
    await db.delete(citations);
  }

  async getCitationCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(citations);
    return Number(result.count);
  }

  async saveArrest(arrestData: any): Promise<any> {
    const { nanoid } = await import("nanoid");
    const [arrest] = await db.insert(arrests).values({
      id: arrestData.id || nanoid(),
      officerBadges: arrestData.officerBadges,
      officerUsernames: arrestData.officerUsernames,
      officerRanks: arrestData.officerRanks,
      officerUserIds: arrestData.officerUserIds,
      arresteeUsername: arrestData.arresteeUsername,
      suspectSignature: arrestData.suspectSignature || arrestData.arresteeSignature,
      officerSignatures: arrestData.officerSignatures || [],
      description: arrestData.description || null,
      mugshotBase64: arrestData.mugshotBase64 || arrestData.mugshot || null,
      penalCodes: arrestData.penalCodes,
      amountsDue: arrestData.amountsDue,
      jailTimes: arrestData.jailTimes,
      totalAmount: arrestData.totalAmount,
      totalJailTime: arrestData.totalJailTime,
      timeServed: arrestData.timeServed || false,
      courtLocation: arrestData.courtLocation,
      courtDate: arrestData.courtDate,
      courtPhone: arrestData.courtPhone,
      additionalNotes: arrestData.additionalNotes || null,
      discordMessageId: arrestData.discordMessageId || null,
      issuedBy: arrestData.issuedBy,
    }).returning();
    return arrest;
  }

  async getAllArrests(): Promise<any[]> {
    return db.select().from(arrests);
  }

  async deleteArrest(id: string): Promise<void> {
    await db.delete(arrests).where(eq(arrests.id, id));
  }

  async deleteAllArrests(): Promise<void> {
    await db.delete(arrests);
  }

  async getArrestCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(arrests);
    return Number(result.count);
  }

  async isUsernameBlocked(username: string): Promise<boolean> {
    const [row] = await db.select().from(deletedUsernames).where(
      sql`lower(${deletedUsernames.username}) = lower(${username})`
    );
    return !!row;
  }

  async blockUsername(username: string): Promise<void> {
    const already = await this.isUsernameBlocked(username);
    if (!already) {
      await db.insert(deletedUsernames).values({ username });
    }
  }

  async unblockUsername(username: string): Promise<void> {
    await db.delete(deletedUsernames).where(
      sql`lower(${deletedUsernames.username}) = lower(${username})`
    );
  }

  async getBlockedUsernames(): Promise<Array<{ id: number; username: string; deletedAt: Date }>> {
    const rows = await db.select().from(deletedUsernames);
    return rows.map(r => ({ id: r.id, username: r.username, deletedAt: r.deletedAt }));
  }

  async terminateUsername(username: string): Promise<void> {
    const already = await this.isUsernameTerminated(username);
    if (!already) {
      await db.insert(terminatedUsernames).values({ username });
    }
  }

  async unterminateUsername(username: string): Promise<void> {
    await db.delete(terminatedUsernames).where(
      sql`lower(${terminatedUsernames.username}) = lower(${username})`
    );
  }

  async getTerminatedUsernames(): Promise<Array<{ id: number; username: string; terminatedAt: Date }>> {
    const rows = await db.select().from(terminatedUsernames);
    return rows.map(r => ({ id: r.id, username: r.username, terminatedAt: r.terminatedAt }));
  }

  async isUsernameTerminated(username: string): Promise<boolean> {
    const [row] = await db.select().from(terminatedUsernames).where(
      sql`lower(${terminatedUsernames.username}) = lower(${username})`
    );
    return !!row;
  }
}

export const storage = new DatabaseStorage();
