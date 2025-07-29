import { type User, type InsertUser, type Citation, type InsertCitation } from "@shared/schema";
import { promises as fs } from "fs";
import path from "path";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, profile: { rpName?: string; rank?: string; discordId?: string; badgeNumber?: string }): Promise<User | undefined>;
  getCitation(id: number): Promise<Citation | undefined>;
  createCitation(citation: InsertCitation): Promise<Citation>;
  getAllCitations(): Promise<Citation[]>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  updateUserAdmin(id: number, isAdmin: boolean): Promise<void>;
}

// Database storage class removed - using in-memory storage only

// File-based storage class that persists users without database costs
export class FileStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private citations: Map<number, Citation> = new Map();
  private nextUserId = 1;
  private nextCitationId = 1;
  private readonly usersFilePath = path.join(process.cwd(), 'users.json');
  private deletedUsernames: Set<string> = new Set();
  private citationCount: number = 0;
  private arrestCount: number = 0; //Simulated arrest count
  private adminUsernames: string[] = ['popfork1', 'admin', 'administrator']; // Admin usernames
  private blockedUsernames: Map<string, { id: number; username: string; deletedAt: Date }> = new Map();
  private nextBlockedId = 1;
  private terminatedUsernames: Map<string, { id: number; username: string; terminatedAt: Date }> = new Map();
  private nextTerminatedId = 1;

  constructor() {
    this.loadUsersFromFile();
  }

  private async loadUsersFromFile() {
    try {
      const data = await fs.readFile(this.usersFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.users = new Map(parsed.users);
      this.nextUserId = parsed.nextUserId || 1;
      this.deletedUsernames = new Set(parsed.deletedUsernames || []);
      this.citationCount = parsed.citationCount || 0;
      this.arrestCount = parsed.arrestCount || 0;
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('No existing users file found, starting fresh');
    }
  }

  private async saveUsersToFile() {
    try {
      const data = {
        users: Array.from(this.users.entries()),
        nextUserId: this.nextUserId,
        deletedUsernames: Array.from(this.deletedUsernames),
        citationCount: this.citationCount,
        arrestCount: this.arrestCount
      };
      await fs.writeFile(this.usersFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save users to file:', error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Check if username is terminated
    if (await this.isUsernameTerminated(username)) {
      return undefined;
    }

    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === username.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.nextUserId++,
      username: insertUser.username,
      password: insertUser.password,
      isAdmin: this.isAdminUsername(insertUser.username) ? "true" : "false",
      badgeNumber: insertUser.badgeNumber,
      rpName: insertUser.rpName || null,
      rank: insertUser.rank || null,
      discordId: insertUser.discordId || null
    };
    this.users.set(user.id, user);
    await this.saveUsersToFile();
    return user;
  }

  async updateUserProfile(id: number, profile: { rpName?: string; rank?: string; discordId?: string; badgeNumber?: string }): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      if (profile.rpName !== undefined) user.rpName = profile.rpName || null;
      if (profile.rank !== undefined) user.rank = profile.rank || null;
      if (profile.discordId !== undefined) user.discordId = profile.discordId || null;
      if (profile.badgeNumber !== undefined) user.badgeNumber = profile.badgeNumber;
      this.users.set(id, user);
      await this.saveUsersToFile();
      return user;
    }
    return undefined;
  }
  private isAdminUsername(username: string): boolean {
    return this.adminUsernames.some(adminUsername => 
      adminUsername.toLowerCase() === username.toLowerCase()
    );
  }

  async getCitation(id: number): Promise<Citation | undefined> {
    return this.citations.get(id);
  }

  async createCitation(insertCitation: InsertCitation): Promise<Citation> {
    const citation: Citation = {
      id: this.nextCitationId++,
      ...insertCitation,
      additionalNotes: insertCitation.additionalNotes || null,
      createdAt: new Date()
    };
    this.citations.set(citation.id, citation);
     this.citationCount++;
    await this.saveUsersToFile();
    return citation;
  }

  async getAllCitations(): Promise<Citation[]> {
    return Array.from(this.citations.values());
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: number): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.deletedUsernames.add(user.username);
      this.users.delete(id);
      await this.saveUsersToFile();
    }
  }

  async updateUserAdmin(id: number, isAdmin: boolean): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.isAdmin = isAdmin ? "true" : "false";
      this.users.set(id, user);
      await this.saveUsersToFile();
    }
  }

  async isUsernameBlocked(username: string): Promise<boolean> {
        // Check if any blocked username matches (case-insensitive)
        for (const blockedUsername of this.deletedUsernames) {
          if (blockedUsername.toLowerCase() === username.toLowerCase()) {
            return true;
          }
        }
        return false;
  }

async unblockUsername(username: string): Promise<void> {
    this.deletedUsernames.delete(username);
    await this.saveUsersToFile();
  }

  async getBlockedUsernames(): Promise<Array<{ id: number; username: string; deletedAt: Date }>> {
    const blockedList: Array<{ id: number; username: string; deletedAt: Date }> = [];
    let id = 1;
    for (const username of this.deletedUsernames) {
      blockedList.push({
        id: id++,
        username: username,
        deletedAt: new Date() // Using current date since we don't store deletion date for old entries
      });
    }
    return blockedList;
  }

    async getCitationCount(): Promise<number> {
        return this.citationCount;
    }

    async getArrestCount(): Promise<number> {
        return this.arrestCount; // Placeholder
    }

    // Method to increment arrest count.  This would be called when an arrest is created.
    async incrementArrestCount(): Promise<void> {
        this.arrestCount++;
        await this.saveUsersToFile();
    }

  private blockedUsernamesFile = 'blocked_usernames.json';

  private async saveBlockedUsernamesToFile() {
    const data = Array.from(this.blockedUsernames.values());
    await fs.writeFile(this.blockedUsernamesFile, JSON.stringify(data, null, 2));
  }

  private async loadBlockedUsernamesFromFile() {
    try {
      if (await fs.access(this.blockedUsernamesFile).then(() => true).catch(() => false)) {
        const data = await fs.readFile(this.blockedUsernamesFile, 'utf-8');
        const blockedUsernames = JSON.parse(data);
        this.blockedUsernames.clear();
        for (const blocked of blockedUsernames) {
          this.blockedUsernames.set(blocked.username, {
            ...blocked,
            deletedAt: new Date(blocked.deletedAt)
          });
          this.nextBlockedId = Math.max(this.nextBlockedId, blocked.id + 1);
        }
      }
    } catch (error) {
      console.error('Error loading blocked usernames:', error);
    }
  }

  private terminatedUsernamesFile = 'terminated_usernames.json';

  private async saveTerminatedUsernamesToFile() {
    const data = Array.from(this.terminatedUsernames.values());
    await fs.writeFile(this.terminatedUsernamesFile, JSON.stringify(data, null, 2));
  }

  private async loadTerminatedUsernamesFromFile() {
    try {
      if (await fs.access(this.terminatedUsernamesFile).then(() => true).catch(() => false)) {
        const data = await fs.readFile(this.terminatedUsernamesFile, 'utf-8');
        const terminatedUsernames = JSON.parse(data);
        this.terminatedUsernames.clear();
        for (const terminated of terminatedUsernames) {
          this.terminatedUsernames.set(terminated.username, {
            ...terminated,
            terminatedAt: new Date(terminated.terminatedAt)
          });
          this.nextTerminatedId = Math.max(this.nextTerminatedId, terminated.id + 1);
        }
      }
    } catch (error) {
      console.error('Error loading terminated usernames:', error);
    }
  }

  async terminateUsername(username: string): Promise<void> {
    const terminated = {
      id: this.nextTerminatedId++,
      username,
      terminatedAt: new Date()
    };
    this.terminatedUsernames.set(username, terminated);
    await this.saveTerminatedUsernamesToFile();
  }

  async unterminateUsername(username: string): Promise<void> {
    this.terminatedUsernames.delete(username);
    await this.saveTerminatedUsernamesToFile();
  }

  async getTerminatedUsernames(): Promise<Array<{ id: number; username: string; terminatedAt: Date }>> {
    return Array.from(this.terminatedUsernames.values());
  }

  async isUsernameTerminated(username: string): Promise<boolean> {
    return this.terminatedUsernames.has(username);
  }

async blockUsername(username: string): Promise<void> {
    if (this.deletedUsernames.has(username)) {
      return;
    }
    this.deletedUsernames.add(username);
    await this.saveUsersToFile();
  }

  
}

// Use file-based storage - persists users without database costs
export const storage = new FileStorage();