import { type User, type InsertUser, type Citation, type InsertCitation } from "@shared/schema";
import { promises as fs } from "fs";
import path from "path";

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
}

// Database storage class removed - using in-memory storage only

// File-based storage class that persists users without database costs
export class FileStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private citations: Map<string, Citation> = new Map(); // Changed to string key for nanoid
  private arrests: Map<string, any> = new Map(); // Add arrests storage
  private nextUserId = 1;
  private nextCitationId = 1;
  private readonly usersFilePath = path.join(process.cwd(), 'users.json');
  private readonly citationsFilePath = path.join(process.cwd(), 'citations.json');
  private readonly arrestsFilePath = path.join(process.cwd(), 'arrests.json');
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
    this.loadCitationsFromFile();
    this.loadArrestsFromFile();
    this.loadBlockedUsernamesFromFile();
    this.loadTerminatedUsernamesFromFile();
  }

  private async loadUsersFromFile() {
    try {
      const data = await fs.readFile(this.usersFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Handle the [id, userObject] format from the JSON file
      this.users = new Map();
      if (parsed.users && Array.isArray(parsed.users)) {
        for (const userEntry of parsed.users) {
          if (Array.isArray(userEntry) && userEntry.length === 2) {
            const [id, userObject] = userEntry;
            this.users.set(id, userObject);
          }
        }
      }

      this.nextUserId = parsed.nextUserId || 1;
      this.deletedUsernames = new Set(parsed.deletedUsernames || []);
      this.citationCount = parsed.citationCount || 0;
      this.arrestCount = parsed.arrestCount || 0;

      console.log(`Loaded ${this.users.size} users from file`);

      // Sync counts with actual data after loading all files
      setTimeout(() => {
        this.citationCount = Math.max(this.citationCount, this.citations.size);
        this.arrestCount = Math.max(this.arrestCount, this.arrests.size);
      }, 100);
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

  private async loadCitationsFromFile() {
    try {
      const data = await fs.readFile(this.citationsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.citations = new Map(parsed.citations.map((c: any) => [c.id, {
        ...c,
        createdAt: new Date(c.createdAt)
      }]));
      this.nextCitationId = parsed.nextCitationId || 1;
    } catch (error) {
      console.log('No existing citations file found, starting fresh');
    }
  }

  private async saveCitationsToFile() {
    try {
      const data = {
        citations: Array.from(this.citations.values()),
        nextCitationId: this.nextCitationId
      };
      await fs.writeFile(this.citationsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save citations to file:', error);
    }
  }

  private async loadArrestsFromFile() {
    try {
      const data = await fs.readFile(this.arrestsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.arrests = new Map(parsed.arrests.map((a: any) => [a.id, {
        ...a,
        createdAt: new Date(a.createdAt)
      }]));
    } catch (error) {
      console.log('No existing arrests file found, starting fresh');
    }
  }

  private async saveArrestsToFile() {
    try {
      const data = {
        arrests: Array.from(this.arrests.values())
      };
      await fs.writeFile(this.arrestsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save arrests to file:', error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
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
    return this.citations.get(id.toString());
  }

  async createCitation(insertCitation: InsertCitation): Promise<Citation> {
    const citation: Citation = {
      id: insertCitation.id || this.nextCitationId++, // Use provided id (nanoid) or generate number
      ...insertCitation,
      additionalNotes: insertCitation.additionalNotes || null,
      createdAt: insertCitation.createdAt || new Date()
    };
    this.citations.set(citation.id.toString(), citation);
    this.citationCount = Math.max(this.citationCount + 1, this.citations.size);
    await this.saveCitationsToFile();
    await this.saveUsersToFile(); // Update citation count
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

  async updateUserAdmin(userId: number, isAdmin: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.isAdmin = isAdmin ? "true" : "false";
      this.users.set(userId, user);
      await this.saveUsersToFile();
    }
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.password = hashedPassword;
      this.users.set(userId, user);
      await this.saveUsersToFile();
      return user;
    }
    return null;
  }

  async isUsernameBlocked(username: string): Promise<boolean> {
        return this.blockedUsernames.has(username.toLowerCase());
  }

async unblockUsername(username: string): Promise<void> {
    this.blockedUsernames.delete(username);
    await this.saveBlockedUsernamesToFile();
  }

  async getBlockedUsernames(): Promise<Array<{ id: number; username: string; deletedAt: Date }>> {
    return Array.from(this.blockedUsernames.values());
  }

    async getCitationCount(): Promise<number> {
        // Return the actual count from the citations map if it's higher
        const actualCount = this.citations.size;
        this.citationCount = Math.max(this.citationCount, actualCount);
        return this.citationCount;
    }

    async getArrestCount(): Promise<number> {
        // Return the actual count from the arrests map if it's higher
        const actualCount = this.arrests.size;
        this.arrestCount = Math.max(this.arrestCount, actualCount);
        return this.arrestCount;
    }

    // Method to increment arrest count.  This would be called when an arrest is created.
    async incrementArrestCount(): Promise<void> {
        this.arrestCount++;
        await this.saveUsersToFile();
    }

  private blockedUsernamesFile = 'blocked_usernames.json';

  private async saveBlockedUsernamesToFile() {
    try {
      const data = Array.from(this.blockedUsernames.values());
      console.log('Saving blocked usernames to file:', data);
      await fs.writeFile(this.blockedUsernamesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving blocked usernames:', error);
    }
  }

  private async loadBlockedUsernamesFromFile() {
    try {
      if (await fs.access(this.blockedUsernamesFile).then(() => true).catch(() => false)) {
        const data = await fs.readFile(this.blockedUsernamesFile, 'utf-8');
        const blockedUsernames = JSON.parse(data);
        this.blockedUsernames.clear();
        for (const blocked of blockedUsernames) {
          // Skip entries without username (corrupted data)
          if (blocked.username) {
            this.blockedUsernames.set(blocked.username, {
              ...blocked,
              deletedAt: new Date(blocked.deletedAt)
            });
            this.nextBlockedId = Math.max(this.nextBlockedId, blocked.id + 1);
          }
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
    if (this.blockedUsernames.has(username)) {
      return;
    }
    const blocked = {
      id: this.nextBlockedId++,
      username: username,
      deletedAt: new Date()
    };
    console.log('Creating blocked entry:', blocked);
    this.blockedUsernames.set(username, blocked);
    console.log('Map now contains:', Array.from(this.blockedUsernames.values()));
    await this.saveBlockedUsernamesToFile();
  }

  // Arrest methods with proper file storage
  async saveArrest(arrestData: any): Promise<void> {
    this.arrests.set(arrestData.id, arrestData);
    this.arrestCount = Math.max(this.arrestCount + 1, this.arrests.size);
    await this.saveArrestsToFile();
    await this.saveUsersToFile(); // Update arrest count
  }

  async getAllArrests(): Promise<any[]> {
    return Array.from(this.arrests.values());
  }

  async deleteCitation(id: string): Promise<void> {
    this.citations.delete(id);
    await this.saveCitationsToFile();
  }

  async deleteArrest(id: string): Promise<void> {
    this.arrests.delete(id);
    await this.saveArrestsToFile();
  }

  async deleteAllCitations(): Promise<void> {
    this.citations.clear();
    this.citationCount = 0;
    await this.saveCitationsToFile();
    await this.saveUsersToFile(); // Update citation count
  }

  async deleteAllArrests(): Promise<void> {
    this.arrests.clear();
    this.arrestCount = 0;
    await this.saveArrestsToFile();
    await this.saveUsersToFile(); // Update arrest count
  }

  async updateUserRank(userId: number, rank: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.rank = rank;
      this.users.set(userId, user);
      await this.saveUsersToFile();
    }
  }
}

// Use file-based storage - persists users without database costs
export const storage = new FileStorage();