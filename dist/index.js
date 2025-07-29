// server/index.ts
import express2 from "express";
import session from "express-session";
import path5 from "path";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// shared/schema.ts
import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  badgeNumber: text("badge_number").notNull(),
  isAdmin: text("is_admin").default("false").notNull(),
  rpName: text("rp_name"),
  rank: text("rank"),
  discordId: text("discord_id")
});
var deletedUsernames = pgTable("deleted_usernames", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull()
});
var citations = pgTable("citations", {
  id: text("id").primaryKey(),
  // Changed to text to support nanoid
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
  discordMessageId: text("discord_message_id"),
  issuedBy: integer("issued_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var arrests = pgTable("arrests", {
  id: text("id").primaryKey(),
  // Changed to text to support nanoid
  officerBadges: text("officer_badges").array().notNull(),
  officerUsernames: text("officer_usernames").array().notNull(),
  officerRanks: text("officer_ranks").array().notNull(),
  officerUserIds: text("officer_user_ids").array().notNull(),
  arresteeUsername: text("arrestee_username").notNull(),
  suspectSignature: text("suspect_signature").notNull(),
  officerSignatures: text("officer_signatures").array().notNull(),
  description: text("description"),
  mugshotBase64: text("mugshot_base64"),
  penalCodes: text("penal_codes").array().notNull(),
  amountsDue: text("amounts_due").array().notNull(),
  jailTimes: text("jail_times").array().notNull(),
  totalAmount: text("total_amount").notNull(),
  totalJailTime: text("total_jail_time").notNull(),
  timeServed: boolean("time_served").default(false),
  courtLocation: text("court_location").notNull(),
  courtDate: text("court_date").notNull(),
  courtPhone: text("court_phone").notNull(),
  additionalNotes: text("additional_notes"),
  discordMessageId: text("discord_message_id"),
  issuedBy: integer("issued_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  badgeNumber: true,
  isAdmin: true,
  rpName: true,
  rank: true,
  discordId: true
}).extend({
  username: z.string().optional(),
  // Make username optional since it comes from Discord
  discordId: z.string().optional()
  // Make discordId optional since it comes from Discord verification
});
var updateUserProfileSchema = createInsertSchema(users).pick({
  rpName: true,
  rank: true,
  discordId: true,
  badgeNumber: true
});
var insertCitationSchema = z.object({
  officerBadges: z.array(z.string().min(1)).min(1, "At least one officer badge is required"),
  officerUsernames: z.array(z.string().min(1)).min(1, "At least one officer username is required"),
  officerRanks: z.array(z.string().min(1)).min(1, "At least one officer rank is required"),
  officerUserIds: z.array(z.string().min(1)).min(1, "At least one officer user ID is required"),
  violatorUsername: z.string().min(1, "Violator username is required"),
  violatorSignature: z.string().min(1, "Violator signature is required"),
  violationType: z.string().default("Citation"),
  penalCodes: z.array(z.string().min(1)).min(1, "At least one penal code is required"),
  amountsDue: z.array(z.string().min(1)).min(1, "At least one amount is required"),
  jailTimes: z.array(z.string()).default([]),
  totalAmount: z.string().min(1, "Total amount is required"),
  totalJailTime: z.string().default("0 Seconds"),
  additionalNotes: z.string().optional().default("")
});
var insertArrestSchema = createInsertSchema(arrests).omit({
  id: true,
  createdAt: true
}).extend({
  // Officer data as arrays
  officerBadges: z.array(z.string().min(1, "Badge number is required")).min(1, "At least one officer badge is required"),
  officerUsernames: z.array(z.string().min(1, "Officer username is required")).min(1, "At least one officer username is required"),
  officerRanks: z.array(z.string().min(1, "Officer rank is required")).min(1, "At least one officer rank is required"),
  officerUserIds: z.array(z.string().min(1, "Officer Discord User ID is required")).min(1, "At least one officer Discord User ID is required"),
  // Penal code data as arrays
  penalCodes: z.array(z.string().min(1, "Penal code is required")),
  amountsDue: z.array(z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")),
  jailTimes: z.array(z.string()).min(1, "At least one jail time is required"),
  totalJailTime: z.string().min(1, "Total jail time is required"),
  // Single values
  arresteeUsername: z.string().min(1, "Arrestee username is required"),
  arresteeSignature: z.string().min(1, "Arrestee signature is required"),
  mugshot: z.string().optional().nullable(),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid total amount format"),
  additionalNotes: z.string().optional()
});
var loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});
var signUpSchema = z.object({
  username: z.string().optional(),
  // Optional since it comes from Discord
  password: z.string().min(6, "Password must be at least 6 characters"),
  badgeNumber: z.string().min(1, "Badge number is required"),
  rpName: z.string().min(1, "RP name is required"),
  rank: z.string().min(1, "Rank is required"),
  discordId: z.string().optional()
});

// server/db.ts
var pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://mock"
});
var db = drizzle(pool);
console.log("Database schemas loaded for type safety - using file-based storage");

// server/routes.ts
import { eq, desc, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

// server/storage.ts
import { promises as fs } from "fs";
import path from "path";
var FileStorage = class {
  users = /* @__PURE__ */ new Map();
  citations = /* @__PURE__ */ new Map();
  // Changed to string key for nanoid
  arrests = /* @__PURE__ */ new Map();
  // Add arrests storage
  nextUserId = 1;
  nextCitationId = 1;
  usersFilePath = path.join(process.cwd(), "users.json");
  citationsFilePath = path.join(process.cwd(), "citations.json");
  arrestsFilePath = path.join(process.cwd(), "arrests.json");
  deletedUsernames = /* @__PURE__ */ new Set();
  citationCount = 0;
  arrestCount = 0;
  //Simulated arrest count
  adminUsernames = ["popfork1", "admin", "administrator"];
  // Admin usernames
  blockedUsernames = /* @__PURE__ */ new Map();
  nextBlockedId = 1;
  terminatedUsernames = /* @__PURE__ */ new Map();
  nextTerminatedId = 1;
  constructor() {
    this.loadUsersFromFile();
    this.loadCitationsFromFile();
    this.loadArrestsFromFile();
    this.loadBlockedUsernamesFromFile();
    this.loadTerminatedUsernamesFromFile();
  }
  async loadUsersFromFile() {
    try {
      const data = await fs.readFile(this.usersFilePath, "utf-8");
      const parsed = JSON.parse(data);
      this.users = /* @__PURE__ */ new Map();
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
      setTimeout(() => {
        this.citationCount = Math.max(this.citationCount, this.citations.size);
        this.arrestCount = Math.max(this.arrestCount, this.arrests.size);
      }, 100);
    } catch (error) {
      console.log("No existing users file found, starting fresh");
    }
  }
  async saveUsersToFile() {
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
      console.error("Failed to save users to file:", error);
    }
  }
  async loadCitationsFromFile() {
    try {
      const data = await fs.readFile(this.citationsFilePath, "utf-8");
      const parsed = JSON.parse(data);
      this.citations = new Map(parsed.citations.map((c) => [c.id, {
        ...c,
        createdAt: new Date(c.createdAt)
      }]));
      this.nextCitationId = parsed.nextCitationId || 1;
    } catch (error) {
      console.log("No existing citations file found, starting fresh");
    }
  }
  async saveCitationsToFile() {
    try {
      const data = {
        citations: Array.from(this.citations.values()),
        nextCitationId: this.nextCitationId
      };
      await fs.writeFile(this.citationsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save citations to file:", error);
    }
  }
  async loadArrestsFromFile() {
    try {
      const data = await fs.readFile(this.arrestsFilePath, "utf-8");
      const parsed = JSON.parse(data);
      this.arrests = new Map(parsed.arrests.map((a) => [a.id, {
        ...a,
        createdAt: new Date(a.createdAt)
      }]));
    } catch (error) {
      console.log("No existing arrests file found, starting fresh");
    }
  }
  async saveArrestsToFile() {
    try {
      const data = {
        arrests: Array.from(this.arrests.values())
      };
      await fs.writeFile(this.arrestsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save arrests to file:", error);
    }
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === username.toLowerCase()) {
        return user;
      }
    }
    return void 0;
  }
  async createUser(insertUser) {
    const user = {
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
  async updateUserProfile(id, profile) {
    const user = this.users.get(id);
    if (user) {
      if (profile.rpName !== void 0) user.rpName = profile.rpName || null;
      if (profile.rank !== void 0) user.rank = profile.rank || null;
      if (profile.discordId !== void 0) user.discordId = profile.discordId || null;
      if (profile.badgeNumber !== void 0) user.badgeNumber = profile.badgeNumber;
      this.users.set(id, user);
      await this.saveUsersToFile();
      return user;
    }
    return void 0;
  }
  isAdminUsername(username) {
    return this.adminUsernames.some(
      (adminUsername) => adminUsername.toLowerCase() === username.toLowerCase()
    );
  }
  async getCitation(id) {
    return this.citations.get(id.toString());
  }
  async createCitation(insertCitation) {
    const citation = {
      id: insertCitation.id || this.nextCitationId++,
      // Use provided id (nanoid) or generate number
      ...insertCitation,
      additionalNotes: insertCitation.additionalNotes || null,
      createdAt: insertCitation.createdAt || /* @__PURE__ */ new Date()
    };
    this.citations.set(citation.id.toString(), citation);
    this.citationCount = Math.max(this.citationCount + 1, this.citations.size);
    await this.saveCitationsToFile();
    await this.saveUsersToFile();
    return citation;
  }
  async getAllCitations() {
    return Array.from(this.citations.values());
  }
  async getAllUsers() {
    return Array.from(this.users.values());
  }
  async deleteUser(id) {
    const user = this.users.get(id);
    if (user) {
      this.deletedUsernames.add(user.username);
      this.users.delete(id);
      await this.saveUsersToFile();
    }
  }
  async updateUserAdmin(userId, isAdmin) {
    const user = this.users.get(userId);
    if (user) {
      user.isAdmin = isAdmin ? "true" : "false";
      this.users.set(userId, user);
      await this.saveUsersToFile();
    }
  }
  async updateUserPassword(userId, hashedPassword) {
    const user = this.users.get(userId);
    if (user) {
      user.password = hashedPassword;
      this.users.set(userId, user);
      await this.saveUsersToFile();
      return user;
    }
    return null;
  }
  async isUsernameBlocked(username) {
    return this.blockedUsernames.has(username.toLowerCase());
  }
  async unblockUsername(username) {
    this.blockedUsernames.delete(username);
    await this.saveBlockedUsernamesToFile();
  }
  async getBlockedUsernames() {
    return Array.from(this.blockedUsernames.values());
  }
  async getCitationCount() {
    const actualCount = this.citations.size;
    this.citationCount = Math.max(this.citationCount, actualCount);
    return this.citationCount;
  }
  async getArrestCount() {
    const actualCount = this.arrests.size;
    this.arrestCount = Math.max(this.arrestCount, actualCount);
    return this.arrestCount;
  }
  // Method to increment arrest count.  This would be called when an arrest is created.
  async incrementArrestCount() {
    this.arrestCount++;
    await this.saveUsersToFile();
  }
  blockedUsernamesFile = "blocked_usernames.json";
  async saveBlockedUsernamesToFile() {
    try {
      const data = Array.from(this.blockedUsernames.values());
      console.log("Saving blocked usernames to file:", data);
      await fs.writeFile(this.blockedUsernamesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error saving blocked usernames:", error);
    }
  }
  async loadBlockedUsernamesFromFile() {
    try {
      if (await fs.access(this.blockedUsernamesFile).then(() => true).catch(() => false)) {
        const data = await fs.readFile(this.blockedUsernamesFile, "utf-8");
        const blockedUsernames = JSON.parse(data);
        this.blockedUsernames.clear();
        for (const blocked of blockedUsernames) {
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
      console.error("Error loading blocked usernames:", error);
    }
  }
  terminatedUsernamesFile = "terminated_usernames.json";
  async saveTerminatedUsernamesToFile() {
    const data = Array.from(this.terminatedUsernames.values());
    await fs.writeFile(this.terminatedUsernamesFile, JSON.stringify(data, null, 2));
  }
  async loadTerminatedUsernamesFromFile() {
    try {
      if (await fs.access(this.terminatedUsernamesFile).then(() => true).catch(() => false)) {
        const data = await fs.readFile(this.terminatedUsernamesFile, "utf-8");
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
      console.error("Error loading terminated usernames:", error);
    }
  }
  async terminateUsername(username) {
    const terminated = {
      id: this.nextTerminatedId++,
      username,
      terminatedAt: /* @__PURE__ */ new Date()
    };
    this.terminatedUsernames.set(username, terminated);
    await this.saveTerminatedUsernamesToFile();
  }
  async unterminateUsername(username) {
    this.terminatedUsernames.delete(username);
    await this.saveTerminatedUsernamesToFile();
  }
  async getTerminatedUsernames() {
    return Array.from(this.terminatedUsernames.values());
  }
  async isUsernameTerminated(username) {
    return this.terminatedUsernames.has(username);
  }
  async blockUsername(username) {
    if (this.blockedUsernames.has(username)) {
      return;
    }
    const blocked = {
      id: this.nextBlockedId++,
      username,
      deletedAt: /* @__PURE__ */ new Date()
    };
    console.log("Creating blocked entry:", blocked);
    this.blockedUsernames.set(username, blocked);
    console.log("Map now contains:", Array.from(this.blockedUsernames.values()));
    await this.saveBlockedUsernamesToFile();
  }
  // Arrest methods with proper file storage
  async saveArrest(arrestData) {
    this.arrests.set(arrestData.id, arrestData);
    this.arrestCount = Math.max(this.arrestCount + 1, this.arrests.size);
    await this.saveArrestsToFile();
    await this.saveUsersToFile();
  }
  async getAllArrests() {
    return Array.from(this.arrests.values());
  }
  async deleteCitation(id) {
    this.citations.delete(id);
    await this.saveCitationsToFile();
  }
  async deleteArrest(id) {
    this.arrests.delete(id);
    await this.saveArrestsToFile();
  }
  async deleteAllCitations() {
    this.citations.clear();
    this.citationCount = 0;
    await this.saveCitationsToFile();
    await this.saveUsersToFile();
  }
  async deleteAllArrests() {
    this.arrests.clear();
    this.arrestCount = 0;
    await this.saveArrestsToFile();
    await this.saveUsersToFile();
  }
};
var storage = new FileStorage();

// server/discord.ts
import { Client, GatewayIntentBits, AttachmentBuilder } from "discord.js";
var DiscordBotServiceImpl = class {
  client;
  channelId;
  isReady = false;
  constructor(token, channelId) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });
    this.channelId = channelId;
    this.client.once("ready", () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
    });
    this.client.login(token);
  }
  async initialize() {
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve();
        return;
      }
      this.client.once("ready", () => {
        resolve();
      });
    });
  }
  async sendCitationReport(data) {
    if (!this.isReady) {
      await this.initialize();
    }
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) {
      throw new Error("Discord channel not found");
    }
    console.log("\u{1F4DD} Formatting citation data:", data);
    let officerInfo = "";
    if (Array.isArray(data.officerBadges)) {
      officerInfo = data.officerBadges.map((badge, index) => {
        const rankText = data.officerRanks[index] || data.officerRanks[0] || "";
        const username = data.officerUsernames[index] || data.officerUsernames[0] || "";
        const userId = data.officerUserIds ? data.officerUserIds[index] || data.officerUserIds[0] || "" : "";
        return `${rankText} @${username} (Badge #${badge})`;
      }).filter((info) => info.trim() !== " @ (Badge #)").join("\n");
    } else {
      officerInfo = `${data.officerRanks || ""} @${data.officerUsernames || ""} (Badge #${data.officerBadges || ""})`;
    }
    let penalCodes = "";
    if (Array.isArray(data.penalCodes)) {
      penalCodes = data.penalCodes.map((code) => `**${code}**`).join(", ");
    } else {
      penalCodes = `**${data.penalCodes}**`;
    }
    let rankSignature = "";
    if (Array.isArray(data.officerRanks)) {
      rankSignature = data.officerRanks.map((rank, index) => {
        const userId = data.officerUserIds ? data.officerUserIds[index] || "" : "";
        const cleanRank = rank.replace(/\s+\d+$/, "").trim();
        return userId ? `${cleanRank} <@${userId}>` : cleanRank;
      }).filter((rank) => rank.trim() !== "").join("\n");
    } else {
      let cleanRank = data.officerRanks || "";
      const userId = data.officerUserIds ? Array.isArray(data.officerUserIds) ? data.officerUserIds[0] : data.officerUserIds : "";
      cleanRank = cleanRank.replace(/\s+\d+$/, "").trim();
      rankSignature = userId ? `${cleanRank} <@${userId}>` : cleanRank;
    }
    const penalCodeDescriptions = {
      "(2)08": "Petty Theft",
      "(2)15": "Loitering",
      "(4)11": "Misuse of Government Hotline",
      "(4)12": "Tampering with Evidence",
      "(5)01": "Disturbing the Peace",
      "(8)01": "Invalid / No Vehicle Registration / Insurance",
      "(8)02": "Driving Without a License",
      "(8)04": "Accident Reporting Requirements - Property Damage",
      "(8)06": "Failure to Obey Traffic Signal",
      "(8)07": "Driving Opposite Direction",
      "(8)08": "Failure to Maintain Lane",
      "(8)09": "Unsafe Following Distance",
      "(8)10": "Failure to Yield to Civilian",
      "(8)11": "Failure to Yield to Emergency Vehicles",
      "(8)12": "Unsafe Turn",
      "(8)13": "Unsafe Lane Change",
      "(8)14": "Illegal U-Turn",
      "(8)15": "Speeding (6-15 MPH Over)",
      "(8)16": "Speeding (16-25 MPH Over)",
      "(8)17": "Speeding (26+ MPH Over)",
      "(8)19": "Unreasonably Slow / Stopped",
      "(8)20": "Failure to Obey Stop Sign / RED LIGHT",
      "(8)21": "Illegally Parked",
      "(8)24": "Throwing Objects",
      "(8)31": "Littering",
      "(8)32": "Unsafe Speed for Conditions",
      "(8)33": "Hogging Passing Lane",
      "(8)34": "Impeding Traffic",
      "(8)35": "Jaywalking",
      "(8)36": "Unnecessary Use of Horn",
      "(8)37": "Excessive Music / Engine Sounds",
      "(8)39": "Failure to Yield to Pedestrian",
      "(8)40": "Distracted Driving",
      "(8)41": "Driving on Shoulder / Emergency Lane",
      "(8)42": "Move Over Law",
      "(8)43": "Driving Without Headlights",
      "(8)44": "Hit and Run",
      "(8)50": "Unroadworthy Vehicle",
      "(8)51": "Drifting on a Public Road",
      "(8)52": "Failure to Control Vehicle",
      "(8)53": "Unsafe Parking (Parking Ticket)",
      "(8)54": "Failure to Use Turn Signal",
      "(8)55": "Failure to Display License Plate (W/ only)"
    };
    let ticketType = "";
    if (Array.isArray(data.penalCodes)) {
      const ticketTypes = data.penalCodes.map(
        (code) => penalCodeDescriptions[code] || data.violationType || "Citation"
      ).filter((type, index, arr) => arr.indexOf(type) === index);
      ticketType = ticketTypes.join(", ");
    } else {
      ticketType = penalCodeDescriptions[data.penalCodes] || data.violationType || "Citation";
    }
    const formattedTotalAmount = parseFloat(data.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const violatorPing = data.violatorUsername && data.violatorUsername.match(/^\d+$/) ? `<@${data.violatorUsername}>` : `**${data.violatorUsername}**`;
    const violatorSignaturePing = data.violatorSignature && data.violatorSignature.match(/^\d+$/) ? `<@${data.violatorSignature}>` : `**${data.violatorSignature}**`;
    const citationMessage = `Ping User Receiving Ticket: ${violatorPing}
Type of Ticket: **${ticketType}**
Penal Code: ${penalCodes}
Total Amount Due: **$${formattedTotalAmount}**
Additional Notes: **${data.additionalNotes || "N/A"}**

Rank and Signature: **${rankSignature}**
Law Enforcement Name(s): **${Array.isArray(data.officerUsernames) ? data.officerUsernames.join(", ") : data.officerUsernames}**
Badge Number: **${Array.isArray(data.officerBadges) ? data.officerBadges.join(", ") : data.officerBadges}**

By signing this citation, you acknowledge that this is NOT an admission of guilt, it is to simply ensure the citation is taken care of. Your court date is shown below, and failure to show will result in a warrant for your arrest. If you have any questions, please contact a Supervisor.

You must pay the citation to <@1392657393724424313>

Sign at the X: ${violatorSignaturePing}

4000 Capitol Drive, Greenville, Wisconsin 54942

Court date: XX/XX/XX
Please call (262) 785-4700 ext. 7 for further inquiry.`;
    console.log("\u{1F4E8} Sending citation message:", citationMessage);
    const message = await channel.send(citationMessage);
    console.log("\u2705 Citation report sent to Discord successfully");
    return message.id;
  }
  async sendArrestReport(data) {
    if (!this.isReady) {
      await this.initialize();
    }
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) {
      throw new Error("Discord channel not found");
    }
    const PENAL_CODE_OPTIONS = [
      // Section 1 - Criminal/Violence
      { code: "(1)01", description: "Criminal Threats", amount: "3750.00", jailTime: "60 Seconds" },
      { code: "(1)02", description: "Assault", amount: "3750.00", jailTime: "240 Seconds" },
      { code: "(1)03", description: "Assault with a Deadly Weapon", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(1)04", description: "Battery", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(1)05", description: "Aggravated Battery", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(1)06", description: "Attempted Murder", amount: "10000.00", jailTime: "240 Seconds" },
      { code: "(1)07", description: "Manslaughter", amount: "0.00", jailTime: "270 Seconds" },
      { code: "(1)08", description: "Murder", amount: "0.00", jailTime: "600 Seconds" },
      { code: "(1)09", description: "False Imprisonment", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(1)10", description: "Kidnapping", amount: "0.00", jailTime: "210 Seconds" },
      { code: "(1)11", description: "Domestic Violence", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(1)12", description: "Domestic Violence (Physical Traumatic Injury)", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(1)13", description: "Assault on a Public Servant", amount: "1000.00", jailTime: "120 Seconds" },
      { code: "(1)14", description: "Attempted Assault on a Public Servant", amount: "1000.00", jailTime: "100 Seconds" },
      { code: "(1)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },
      // Section 2 - Property Crimes
      { code: "(2)01", description: "Arson", amount: "0.00", jailTime: "210 Seconds" },
      { code: "(2)02", description: "Trespassing", amount: "1000.00", jailTime: "15 Seconds" },
      { code: "(2)03", description: "Trespassing within a Restricted Facility", amount: "10000.00", jailTime: "60 Seconds" },
      { code: "(2)04", description: "Burglary", amount: "0.00", jailTime: "150 Seconds" },
      { code: "(2)05", description: "Possession of Burglary Tools", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(2)06", description: "Robbery", amount: "0.00", jailTime: "150 Seconds" },
      { code: "(2)07", description: "Armed Robbery", amount: "0.00", jailTime: "390 Seconds" },
      { code: "(2)08", description: "Petty Theft", amount: "1000.00", jailTime: "None" },
      { code: "(2)09", description: "Grand Theft", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)10", description: "Grand Theft Auto", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)11", description: "Receiving Stolen Property", amount: "10000.00", jailTime: "90 Seconds" },
      { code: "(2)12", description: "Extortion", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(2)13", description: "Forgery / Fraud", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)14", description: "Vandalism", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)15", description: "Loitering", amount: "1000.00", jailTime: "None" },
      { code: "(2)16", description: "Destruction of Civilian Property", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(2)17", description: "Destruction of Government Property", amount: "10000.00", jailTime: "120 Seconds" },
      // Section 3 - Public Order
      { code: "(3)01", description: "Lewd or Dissolute Conduct in Public", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(3)02", description: "Stalking", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(3)03", description: "Public Urination", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(3)04", description: "Public Defecation", amount: "0.00", jailTime: "120 Seconds" },
      // Section 4 - Government/Law Enforcement
      { code: "(4)01", description: "Bribery", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(4)02", description: "Dissuading a Victim", amount: "0.00", jailTime: "60 Seconds" },
      { code: "(4)03", description: "False Information to a Peace Officer", amount: "0.00", jailTime: "30 Seconds" },
      { code: "(4)04", description: "Filing a False Police Report", amount: "0.00", jailTime: "60 Seconds" },
      { code: "(4)05", description: "Failure to Identify to a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)06", description: "Impersonation of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)07", description: "Obstruction of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)08", description: "Resisting a Peace Officer", amount: "1000.00", jailTime: "120 Seconds" },
      { code: "(4)09", description: "Escape from Custody", amount: "1000.00", jailTime: "210 Seconds" },
      { code: "(4)10", description: "Prisoner Breakout", amount: "10000.00", jailTime: "90 Seconds" },
      { code: "(4)11", description: "Misuse of Government Hotline", amount: "1000.00", jailTime: "None" },
      { code: "(4)12", description: "Tampering with Evidence", amount: "1000.00", jailTime: "None" },
      { code: "(4)13", description: "Introduction of Contraband", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(4)14", description: "False Arrest", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(4)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },
      { code: "(4)16", description: "Obstruction of Justice", amount: "500.00", jailTime: "60 Seconds" },
      { code: "(4)17", description: "Disorderly Conduct", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)18", description: "Failure to Comply with a Lawful Order", amount: "500.00", jailTime: "60 Seconds" },
      { code: "(4)19", description: "Aiding and Abetting", amount: "0.00", jailTime: "90 Seconds" },
      // Section 5 - Public Disturbance
      { code: "(5)01", description: "Disturbing the Peace", amount: "500.00", jailTime: "None" },
      { code: "(5)02", description: "Unlawful Assembly", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(5)03", description: "Inciting Riot", amount: "1000.00", jailTime: "120 Seconds" },
      // Section 6 - Drug Related
      { code: "(6)04", description: "Maintaining a Place for the Purpose of Distribution", amount: "10000.00", jailTime: "90 Seconds" },
      { code: "(6)05", description: "Manufacture of a Controlled Substance", amount: "50000.00", jailTime: "180 Seconds" },
      { code: "(6)06", description: "Sale of a Controlled Substance", amount: "5000.00", jailTime: "180 Seconds" },
      { code: "(6)08", description: "Under the Influence of a Controlled Substance", amount: "2000.00", jailTime: "180 Seconds" },
      { code: "(6)09", description: "Detention of Mentally Disordered Persons", amount: "0.00", jailTime: "180 Seconds" },
      // Section 7 - Animal/Child
      { code: "(7)01", description: "Animal Abuse / Cruelty", amount: "20000.00", jailTime: "90 Seconds" },
      { code: "(7)04", description: "Child Endangerment", amount: "10000.00", jailTime: "60 Seconds" },
      // Section 8 - Traffic Violations
      { code: "(8)01", description: "Invalid / No Vehicle Registration / Insurance", amount: "200.00", jailTime: "None" },
      { code: "(8)02", description: "Driving Without a License", amount: "1000.00", jailTime: "None" },
      { code: "(8)03", description: "Driving With a Suspended or Revoked License", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(8)04", description: "Accident Reporting Requirements - Property Damage", amount: "1000.00", jailTime: "None" },
      { code: "(8)05", description: "Accident Reporting Requirements - Injury or Death", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(8)06", description: "Failure to Obey Traffic Signal", amount: "250.00", jailTime: "None" },
      { code: "(8)07", description: "Driving Opposite Direction", amount: "500.00", jailTime: "None" },
      { code: "(8)08", description: "Failure to Maintain Lane", amount: "250.00", jailTime: "None" },
      { code: "(8)09", description: "Unsafe Following Distance", amount: "250.00", jailTime: "None" },
      { code: "(8)10", description: "Failure to Yield to Civilian", amount: "250.00", jailTime: "None" },
      { code: "(8)11", description: "Failure to Yield to Emergency Vehicles", amount: "250.00", jailTime: "None" },
      { code: "(8)12", description: "Unsafe Turn", amount: "250.00", jailTime: "None" },
      { code: "(8)13", description: "Unsafe Lane Change", amount: "250.00", jailTime: "None" },
      { code: "(8)14", description: "Illegal U-Turn", amount: "250.00", jailTime: "None" },
      { code: "(8)15", description: "Speeding (5-15 MPH Over)", amount: "250.00", jailTime: "None" },
      { code: "(8)16", description: "Speeding (16-25 MPH Over)", amount: "360.00", jailTime: "None" },
      { code: "(8)17", description: "Speeding (26+ MPH Over)", amount: "500.00", jailTime: "None" },
      { code: "(8)18", description: "Felony Speeding (100 MPH+)", amount: "5000.00", jailTime: "30 Seconds" },
      { code: "(8)19", description: "Unreasonably Slow / Stopped", amount: "250.00", jailTime: "None" },
      { code: "(8)20", description: "Failure to Obey Stop Sign / RED LIGHT", amount: "250.00", jailTime: "None" },
      { code: "(8)21", description: "Illegally Parked", amount: "250.00", jailTime: "None" },
      { code: "(8)22", description: "Reckless Driving", amount: "1000.00", jailTime: "30 Seconds" },
      { code: "(8)23", description: "Street Racing", amount: "1000.00", jailTime: "30 Seconds" },
      { code: "(8)24", description: "Throwing Objects", amount: "1000.00", jailTime: "None" },
      { code: "(8)25", description: "Operating While Intoxicated", amount: "2000.00", jailTime: "60 Seconds" },
      { code: "(8)26", description: "Evading a Peace Officer", amount: "0.00", jailTime: "270 Seconds" },
      { code: "(8)29", description: "Felony Evading a Peace Officer", amount: "0.00", jailTime: "300 Seconds" },
      { code: "(8)30", description: "Road Rage", amount: "0.00", jailTime: "30 Seconds" },
      { code: "(8)31", description: "Littering", amount: "1000.00", jailTime: "None" },
      { code: "(8)32", description: "Unsafe Speed for Conditions", amount: "2000.00", jailTime: "None" },
      { code: "(8)33", description: "Hogging Passing Lane", amount: "250.00", jailTime: "None" },
      { code: "(8)34", description: "Impeding Traffic", amount: "250.00", jailTime: "None" },
      { code: "(8)35", description: "Jaywalking", amount: "250.00", jailTime: "None" },
      { code: "(8)36", description: "Unnecessary Use of Horn", amount: "400.00", jailTime: "None" },
      { code: "(8)37", description: "Excessive Music / Engine Sounds", amount: "400.00", jailTime: "None" },
      { code: "(8)38", description: "Failure to Sign Citation", amount: "250.00", jailTime: "30 Seconds" },
      { code: "(8)39", description: "Failure to Yield to Pedestrian", amount: "250.00", jailTime: "None" },
      { code: "(8)40", description: "Distracted Driving", amount: "1000.00", jailTime: "None" },
      { code: "(8)41", description: "Driving on Shoulder / Emergency Lane", amount: "250.00", jailTime: "None" },
      { code: "(8)42", description: "Move Over Law", amount: "1000.00", jailTime: "None" },
      { code: "(8)43", description: "Driving Without Headlights", amount: "250.00", jailTime: "None" },
      { code: "(8)44", description: "Hit and Run", amount: "500.00", jailTime: "None" },
      { code: "(8)45", description: "Attempted Vehicular Manslaughter", amount: "750.00", jailTime: "60 Seconds" },
      { code: "(8)46", description: "Vehicular Manslaughter", amount: "750.00", jailTime: "120 Seconds" },
      { code: "(8)47", description: "Reckless Evasion", amount: "750.00", jailTime: "120 Seconds" },
      { code: "(8)48", description: "Possession of a Stolen Vehicle", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(8)49", description: "Reckless Endangerments", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(8)50", description: "Unroadworthy Vehicle", amount: "1000.00", jailTime: "None" },
      { code: "(8)51", description: "Drifting on a Public Road", amount: "250.00", jailTime: "None" },
      { code: "(8)52", description: "Failure to Control Vehicle", amount: "250.00", jailTime: "None" },
      { code: "(8)53", description: "Unsafe Parking (Parking Ticket)", amount: "100.00", jailTime: "None" },
      { code: "(8)54", description: "Failure to Use Turn Signal", amount: "100.00", jailTime: "None" },
      { code: "(8)55", description: "Failure to Display License Plate (W/ only)", amount: "300.00", jailTime: "None" },
      // Section 9 - Weapons
      { code: "(9)01", description: "Possession of an Illegal Weapon", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(9)02", description: "Brandishing a Firearm", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(9)03", description: "Illegal Discharge of a Firearm", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(9)04", description: "Unlicensed Possession of a Firearm", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(9)05", description: "Possession of a Stolen Weapon", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(9)06", description: "Unlawful Distribution of a Firearm", amount: "0.00", jailTime: "90 Seconds" }
    ];
    const officerUsernames = Array.isArray(data.officerUsernames) ? data.officerUsernames.join(", ") : data.officerUsernames || "N/A";
    const officerRanks = Array.isArray(data.officerRanks) ? data.officerRanks.join(", ") : data.officerRanks || "N/A";
    const badgeNumbers = Array.isArray(data.officerBadges) ? data.officerBadges.join(", ") : data.officerBadges || "N/A";
    let officerSignatures = "";
    if (Array.isArray(data.officerUserIds)) {
      officerSignatures = data.officerUserIds.map((userId, index) => {
        const rank = data.officerRanks[index] || data.officerRanks[0] || "";
        const cleanRank = rank.replace(/\s+\d+$/, "").trim();
        return userId ? `${cleanRank} <@${userId}>` : cleanRank;
      }).filter((sig) => sig.trim() !== "").join("\n");
    } else {
      const userId = data.officerUserIds || "";
      let cleanRank = data.officerRanks || "";
      cleanRank = cleanRank.replace(/\s+\d+$/, "").trim();
      officerSignatures = userId ? `${cleanRank} <@${userId}>` : cleanRank;
    }
    const suspectSignature = data.suspectSignature && data.suspectSignature.match(/^\d+$/) ? `<@${data.suspectSignature}>` : `**${data.suspectSignature || "N/A"}**`;
    const penalCodes = data.penalCodes.map((code, index) => {
      const description = PENAL_CODE_OPTIONS.find((option) => option.code === code)?.description || "Unknown Offense";
      const jailTime = data.jailTimes[index];
      const amount = data.amountsDue[index];
      let line = `**${code}** - **${description}**`;
      if (jailTime && jailTime !== "None") line += ` - **${jailTime}**`;
      if (amount && amount !== "0.00") {
        const formattedAmount = parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        line += ` - **$${formattedAmount}**`;
      }
      return line;
    }).join("\n");
    const formattedTotalAmount = parseFloat(data.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalJailTimeSeconds = parseInt((data.totalJailTime || "0 Seconds").replace(" Seconds", "")) || 0;
    const actualTotalTime = data.jailTimes.reduce((total, timeStr) => {
      const seconds = parseInt(timeStr.replace(" Seconds", "")) || 0;
      return total + seconds;
    }, 0);
    const finalSentenceSeconds = parseInt((data.totalJailTime || "0 Seconds").replace(" Seconds", "")) || 0;
    const warrantNeeded = data.timeServed ? "No" : finalSentenceSeconds > 0 ? "Yes" : "No";
    const warrantTime = data.timeServed ? "N/A" : finalSentenceSeconds > 0 ? data.totalJailTime : "N/A";
    const warrantInformation = `Warrant Information:
Warrant Needed: ${warrantNeeded}
Time Needed for Warrant: ${warrantTime}
`;
    const shouldIncludeMugshot = data.mugshotBase64 && !data.description;
    const descriptionText = data.description || (shouldIncludeMugshot ? "See attached mugshot" : "No description provided");
    let formattedOfficerSignatures = "";
    if (Array.isArray(data.officerUserIds)) {
      formattedOfficerSignatures = data.officerUserIds.map((userId, index) => {
        const rank = data.officerRanks[index] || data.officerRanks[0] || "";
        const cleanRank = rank.replace(/\s+\d+$/, "").trim();
        const signature = userId ? `<@${userId}>` : cleanRank;
        return `Arresting officer #${index + 1} signature X: ${signature}`;
      }).filter((sig) => sig.trim() !== "").join("\n");
    } else {
      const userId = data.officerUserIds || "";
      let cleanRank = data.officerRanks || "";
      cleanRank = cleanRank.replace(/\s+\d+$/, "").trim();
      const signature = userId ? `<@${userId}>` : cleanRank;
      formattedOfficerSignatures = `Arresting officer #1 signature X: ${signature}`;
    }
    const arrestMessage = `**Arrest Report**

Officer's Username: ${officerSignatures}
Law Enforcement username(s): ${data.officerUsernames.map((username) => `**${username}**`).join(", ")}
Ranks: **${officerRanks}**
Badge Number: **${badgeNumbers}**

Description/Mugshot
**${descriptionText}**

\u2014
Offense: 
${penalCodes}

Total: **$${formattedTotalAmount}** + **${actualTotalTime} Seconds** ${data.timeServed ? "**(TIME SERVED)**" : ""}

Warrant Information:
Warrant Needed: **${warrantNeeded}**
Time Needed for Warrant: **${warrantTime}**

Sign at the X:
${suspectSignature}

${formattedOfficerSignatures}

${data.courtLocation}

Court date: **${data.courtDate}**
Please call **${data.courtPhone}** for further inquiry.`;
    console.log("\u{1F4E8} Sending arrest message:", arrestMessage);
    const messageOptions = { content: arrestMessage };
    if (data.mugshotBase64) {
      try {
        const base64Data = data.mugshotBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const attachment = new AttachmentBuilder(buffer, { name: "mugshot.png" });
        messageOptions.files = [attachment];
      } catch (error) {
        console.error("Failed to process mugshot attachment:", error);
      }
    }
    const message = await channel.send(messageOptions);
    console.log("\u2705 Arrest report sent to Discord successfully");
    return message.id;
  }
  async deleteMessage(messageId) {
    if (!this.isReady) {
      await this.initialize();
    }
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        throw new Error("Discord channel not found");
      }
      const message = await channel.messages.fetch(messageId);
      if (message) {
        await message.delete();
        console.log(`\u2705 Discord message ${messageId} deleted successfully`);
      }
    } catch (error) {
      if (error.code === 10008) {
        console.log(`\u2139\uFE0F Discord message ${messageId} was already deleted or doesn't exist`);
        return;
      }
      console.error(`\u274C Failed to delete Discord message ${messageId}:`, error);
      throw new Error(`Failed to delete Discord message: ${messageId}`);
    }
  }
  async sendPasswordResetCode(discordUserId, resetCode) {
    try {
      const user = await this.client.users.fetch(discordUserId);
      const embed = {
        color: 3447003,
        title: "\u{1F510} Password Reset Code",
        description: `Here is your password reset verification code:`,
        fields: [
          {
            name: "Verification Code",
            value: `\`\`\`${resetCode}\`\`\``,
            inline: false
          },
          {
            name: "\u26A0\uFE0F Important",
            value: "\u2022 This code expires in 15 minutes\n\u2022 Do not share this code with anyone\n\u2022 Copy and paste the entire code",
            inline: false
          }
        ],
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        footer: {
          text: "Police Department Security System"
        }
      };
      await user.send({ embeds: [embed] });
      console.log(`\u2705 Password reset code sent to Discord user ${discordUserId}`);
    } catch (error) {
      console.error(`\u274C Failed to send password reset code to ${discordUserId}:`, error);
      throw new Error("Failed to send password reset code via Discord");
    }
  }
  async sendDirectMessage(userId, message) {
    if (!this.isReady) {
      await this.initialize();
    }
    try {
      const user = await this.client.users.fetch(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      await user.send(message);
      console.log(`\u2705 Direct message sent to Discord user ${userId}`);
    } catch (error) {
      console.error(`\u274C Failed to send direct message to ${userId}:`, error);
      throw new Error(`Failed to send direct message via Discord: ${userId}`);
    }
  }
  async verifyUserInServer(username, requiredRole) {
    if (!this.isReady) {
      await this.initialize();
    }
    try {
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        console.warn("No guild found. Ensure the bot is added to a server.");
        return false;
      }
      const user = guild.members.cache.find((member) => member.user.username === username);
      if (!user) {
        console.warn(`User not found in the server: ${username}`);
        return false;
      }
      if (requiredRole) {
        const role = guild.roles.cache.find((role2) => role2.name === requiredRole);
        if (!role) {
          console.warn(`Required role not found: ${requiredRole}`);
          return false;
        }
        if (!user.roles.cache.has(role.id)) {
          console.warn(`User does not have the required role: ${username}`);
          return false;
        }
      }
      console.log(`\u2705 User ${username} verified in the server.`);
      return true;
    } catch (error) {
      console.error(`\u274C Failed to verify user in server:`, error);
      return false;
    }
  }
};
function createDiscordBotService(token, channelId) {
  return new DiscordBotServiceImpl(token, channelId);
}

// server/discord-oauth.ts
import axios from "axios";
var DiscordOAuthServiceImpl = class {
  clientId;
  clientSecret;
  redirectUri;
  botToken;
  requiredGuildId;
  constructor(clientId, clientSecret, redirectUri, botToken, requiredGuildId) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.botToken = botToken;
    this.requiredGuildId = requiredGuildId;
  }
  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "identify guilds guilds.members.read",
      state
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }
  async exchangeCode(code) {
    try {
      const tokenResponse = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: this.redirectUri
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );
      const { access_token } = tokenResponse.data;
      const userResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      return {
        accessToken: access_token,
        user: userResponse.data
      };
    } catch (error) {
      console.error("Discord OAuth error:", error);
      throw new Error("Failed to authenticate with Discord");
    }
  }
  async getUserGuilds(accessToken) {
    try {
      const response = await axios.get("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error("Failed to get user guilds:", error);
      throw new Error("Failed to get Discord server list");
    }
  }
  async checkUserRole(accessToken, guildId, requiredRole) {
    try {
      console.log("\u{1F50D} checkUserRole called with guildId:", guildId, "requiredRole:", requiredRole);
      const guilds = await this.getUserGuilds(accessToken);
      console.log("\u{1F4CB} User is in guilds:", guilds.map((g) => `${g.name} (${g.id})`));
      const isInGuild = guilds.some((guild) => guild.id === guildId);
      console.log("\u{1F50D} User is in target guild:", isInGuild);
      if (!isInGuild) {
        console.log("\u274C User is not in the required guild");
        return false;
      }
      if (!requiredRole) {
        console.log("\u2705 No specific role required - user is in guild");
        return true;
      }
      const userResponse = await axios.get(`https://discord.com/api/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const userId = userResponse.data.id;
      console.log("\u{1F464} User ID:", userId);
      const memberResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
        headers: {
          Authorization: `Bot ${this.botToken}`
        }
      });
      const memberRoles = memberResponse.data.roles;
      console.log("\u{1F3AD} User roles in guild:", memberRoles);
      const rolesResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/roles`, {
        headers: {
          Authorization: `Bot ${this.botToken}`
        }
      });
      const guildRoles = rolesResponse.data;
      console.log("\u{1F4CB} Available guild roles:", guildRoles.map((r) => `${r.name} (${r.id})`));
      const requiredRoleObj = guildRoles.find(
        (role) => role.name.toLowerCase() === requiredRole.toLowerCase()
      );
      if (!requiredRoleObj) {
        console.log(`\u274C Required role "${requiredRole}" not found in guild`);
        return false;
      }
      console.log("\u{1F3AF} Required role found:", requiredRoleObj.name, "ID:", requiredRoleObj.id);
      const hasRole = memberRoles.includes(requiredRoleObj.id);
      console.log("\u{1F50D} User has required role:", hasRole);
      return hasRole;
    } catch (error) {
      console.error("\u274C Failed to check user role:", error);
      return false;
    }
  }
};
function createDiscordOAuthService(clientId, clientSecret, redirectUri, botToken, requiredGuildId) {
  return new DiscordOAuthServiceImpl(clientId, clientSecret, redirectUri, botToken, requiredGuildId);
}
var defaultService = createDiscordOAuthService(
  process.env.DISCORD_CLIENT_ID || "",
  process.env.DISCORD_CLIENT_SECRET || "",
  process.env.DISCORD_REDIRECT_URI || getDefaultRedirectUri(),
  process.env.DISCORD_BOT_TOKEN || "",
  process.env.DISCORD_GUILD_ID
);
function getDefaultRedirectUri() {
  if (process.env.RENDER_EXTERNAL_URL) {
    return `${process.env.RENDER_EXTERNAL_URL}/api/auth/discord/callback`;
  }
  if (process.env.REPLIT_DOMAIN) {
    return `${process.env.REPLIT_DOMAIN}/api/auth/discord/callback`;
  }
  return "http://localhost:5000/api/auth/discord/callback";
}
function getDiscordAuthUrl(mode) {
  const state = `${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  return defaultService.getAuthUrl(state);
}
async function handleDiscordCallback(code, state) {
  const [mode] = state.split("_");
  console.log("\u{1F50D} Discord callback - Mode:", mode, "State:", state);
  const { accessToken, user } = await defaultService.exchangeCode(code);
  console.log("\u2705 Discord user authenticated:", user.username, "ID:", user.id);
  if (process.env.DISCORD_GUILD_ID) {
    console.log("\u{1F50D} Checking user access to guild:", process.env.DISCORD_GUILD_ID);
    const requiredRole = process.env.DISCORD_REQUIRED_ROLE;
    console.log("\u{1F50D} Required role:", requiredRole);
    const hasAccess = await defaultService.checkUserRole(accessToken, process.env.DISCORD_GUILD_ID, requiredRole);
    console.log("\u{1F50D} User has access to guild with required role:", hasAccess);
    if (!hasAccess) {
      if (requiredRole) {
        console.log("\u274C User does not have the required role '" + requiredRole + "' in the Discord server");
        throw new Error(`User does not have the required role '${requiredRole}' in the Discord server`);
      } else {
        console.log("\u274C User is not a member of the required Discord server");
        throw new Error("User is not a member of the required Discord server");
      }
    }
  } else {
    console.log("\u26A0\uFE0F No DISCORD_GUILD_ID set - skipping guild verification");
  }
  return { mode, user };
}

// server/routes.ts
import path2 from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var useFileStorage = false;
try {
  await db.select().from(users).limit(1);
  console.log("Database connected successfully");
} catch (error) {
  console.log("Database not available, using file storage");
  useFileStorage = true;
}
function registerRoutes(app2) {
  const requireAuth = (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };
  const requireAdmin = (req, res, next) => {
    if (req.session?.user?.isAdmin !== true) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };
  app2.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt with data:", req.body);
      const validatedData = loginSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      if (useFileStorage) {
        const isTerminated = await storage.isUsernameTerminated(validatedData.username);
        console.log("Username terminated check:", isTerminated);
        if (isTerminated) {
          return res.status(401).json({ message: "This account has been terminated" });
        }
      }
      let user;
      if (useFileStorage) {
        const allUsers = await storage.getAllUsers();
        console.log("All users found:", allUsers.length);
        user = allUsers.find((u) => u.username.toLowerCase() === validatedData.username.toLowerCase());
        console.log("User found:", user ? `Username: ${user.username}, ID: ${user.id}` : "No user found");
      } else {
        const result = await db.select().from(users).where(eq(users.username, validatedData.username)).limit(1);
        user = result[0];
      }
      if (!user) {
        console.log("No user found for username:", validatedData.username);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      console.log("Comparing password for user:", user.username);
      console.log("Stored hash:", user.password);
      console.log("Input password:", validatedData.password);
      const isValid = await bcrypt.compare(validatedData.password, user.password);
      console.log("Password comparison result:", isValid);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.user = {
        id: user.id,
        username: user.username,
        badgeNumber: user.badgeNumber,
        fullName: user.rpName || user.username,
        department: "Police Department",
        rank: user.rank || "Officer",
        email: user.username + "@police.dept",
        phoneNumber: "555-0000",
        isAdmin: user.isAdmin === "true",
        avatarUrl: null,
        discordId: user.discordId
      };
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        console.log("Session saved successfully, user:", req.session.user?.username);
        res.json({
          message: "Login successful",
          user: req.session.user
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      console.log("=== SIGNUP REQUEST DEBUG ===");
      console.log("Raw request body:", JSON.stringify(req.body, null, 2));
      console.log("Request headers:", req.headers);
      console.log("Session data:", JSON.stringify(req.session, null, 2));
      if (req.body.fullName && !req.body.rpName) {
        req.body.rpName = req.body.fullName;
        console.log("Applied backward compatibility: fullName -> rpName");
      }
      const validatedData = signUpSchema.parse(req.body);
      console.log("Validation successful, validated data:", JSON.stringify(validatedData, null, 2));
      const discordVerification = req.session?.discordVerified;
      if (!discordVerification) {
        return res.status(400).json({
          message: "Discord verification required. Please complete Discord authentication first."
        });
      }
      validatedData.discordId = discordVerification.id;
      if (!validatedData.username) {
        validatedData.username = discordVerification.username;
      }
      console.log("Username for signup:", validatedData.username);
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      let existingUser;
      if (useFileStorage) {
        existingUser = await storage.getUserByUsername(validatedData.username);
      } else {
        const result = await db.select().from(users).where(eq(users.username, validatedData.username)).limit(1);
        existingUser = result[0];
      }
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const userData = {
        username: validatedData.username,
        password: hashedPassword,
        badgeNumber: validatedData.badgeNumber,
        isAdmin: "false",
        rpName: validatedData.rpName,
        rank: validatedData.rank,
        discordId: discordVerification.id
      };
      let createdUser;
      if (useFileStorage) {
        createdUser = await storage.createUser(userData);
      } else {
        const result = await db.insert(users).values(userData).returning();
        createdUser = result[0];
      }
      delete req.session.discordVerified;
      req.session.user = {
        id: createdUser.id,
        username: createdUser.username,
        badgeNumber: createdUser.badgeNumber,
        fullName: createdUser.rpName || createdUser.username,
        department: "Police Department",
        rank: createdUser.rank || "Officer",
        email: createdUser.username + "@police.dept",
        phoneNumber: "555-0000",
        isAdmin: createdUser.isAdmin === "true",
        avatarUrl: null,
        discordId: createdUser.discordId
      };
      res.json({
        message: "Account created successfully",
        user: req.session.user
      });
    } catch (error) {
      console.error("=== SIGNUP ERROR DEBUG ===");
      console.error("Error type:", error.constructor.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      if (error.name === "ZodError") {
        console.error("Zod validation errors:", JSON.stringify(error.errors, null, 2));
        const errorDetails = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        console.error("Error details:", errorDetails);
        return res.status(400).json({
          message: "Invalid input data",
          errors: error.errors,
          details: errorDetails,
          received: req.body
        });
      }
      console.error("Non-validation error occurred");
      res.status(500).json({
        message: "Failed to create account",
        error: error.message
      });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });
  app2.get("/api/auth/me", (req, res) => {
    console.log("=== /api/auth/me Debug ===");
    console.log("Session ID:", req.sessionID);
    console.log("Session exists:", !!req.session);
    console.log("Session user:", req.session?.user);
    console.log("Session data:", JSON.stringify(req.session, null, 2));
    if (!req.session?.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ user: req.session.user });
  });
  app2.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { rpName, rank, discordId, badgeNumber } = req.body;
      let updatedUser;
      if (useFileStorage) {
        updatedUser = await storage.updateUserProfile(req.session.user.id, {
          rpName,
          rank,
          discordId,
          badgeNumber
        });
      } else {
        const result = await db.update(users).set({
          rpName,
          rank,
          discordId,
          badgeNumber
        }).where(eq(users.id, req.session.user.id)).returning();
        updatedUser = result[0];
      }
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      req.session.user = {
        ...req.session.user,
        badgeNumber: updatedUser.badgeNumber,
        fullName: updatedUser.rpName || updatedUser.username,
        rank: updatedUser.rank || "Officer",
        discordId: updatedUser.discordId
      };
      res.json({
        message: "Profile updated successfully",
        user: req.session.user
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  app2.get("/api/auth/discord", (req, res) => {
    const { mode } = req.query;
    const discordAuthUrl = getDiscordAuthUrl(mode);
    res.json({ url: discordAuthUrl });
  });
  app2.get("/api/auth/discord/url", (req, res) => {
    const { mode } = req.query;
    const discordAuthUrl = getDiscordAuthUrl(mode || "signup");
    res.json({ url: discordAuthUrl });
  });
  app2.get("/api/auth/discord/status", (req, res) => {
    const discordVerified = req.session?.discordVerified;
    res.json({ verified: !!discordVerified, user: discordVerified });
  });
  app2.get("/api/auth/discord/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        return res.status(400).json({ message: "Missing code or state" });
      }
      const result = await handleDiscordCallback(code, state);
      req.session.discordVerified = {
        id: result.user.id,
        username: result.user.username,
        discriminator: result.user.discriminator || "0000",
        verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
        }
        res.redirect("/discord-callback?verified=true");
      });
    } catch (error) {
      console.error("Discord callback error:", error);
      let errorMessage = "discord_failed";
      if (error instanceof Error) {
        if (error.message.includes("required role")) {
          errorMessage = "insufficient_role";
        } else if (error.message.includes("not a member")) {
          errorMessage = "not_member";
        } else if (error.message.includes("Failed to authenticate")) {
          errorMessage = "auth_failed";
        }
      }
      res.redirect(`/discord-callback?error=${errorMessage}`);
    }
  });
  app2.post("/api/auth/discord/disconnect", (req, res) => {
    try {
      if (req.session) {
        delete req.session.discordVerified;
        req.session.save((err) => {
          if (err) {
            console.error("Session save error during disconnect:", err);
            return res.status(500).json({ message: "Failed to disconnect Discord" });
          }
          res.json({ message: "Discord account disconnected successfully" });
        });
      } else {
        res.json({ message: "No Discord connection to disconnect" });
      }
    } catch (error) {
      console.error("Discord disconnect error:", error);
      res.status(500).json({ message: "Failed to disconnect Discord" });
    }
  });
  app2.post("/api/citations", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCitationSchema.parse(req.body);
      let citationData = {
        ...validatedData,
        id: nanoid(),
        issuedBy: req.session.user.id,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      let discordMessageId = null;
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;
        if (discordBotToken && discordChannelId) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          discordMessageId = await discordBot.sendCitationReport(citationData);
          console.log("\u2705 Citation sent to Discord successfully, message ID:", discordMessageId);
          citationData = { ...citationData, discordMessageId };
        } else {
          console.log("\u26A0\uFE0F Discord bot credentials not configured, citation saved locally only");
        }
      } catch (discordError) {
        console.error("\u274C Failed to send citation to Discord:", discordError);
      }
      if (useFileStorage) {
        await storage.createCitation(citationData);
      } else {
        await db.insert(citations).values(citationData);
      }
      res.json({
        message: "Citation created successfully",
        citation: citationData
      });
    } catch (error) {
      console.error("Citation creation error:", error);
      res.status(500).json({ message: "Failed to create citation" });
    }
  });
  app2.get("/api/citations", requireAuth, async (req, res) => {
    try {
      let userCitations;
      if (useFileStorage) {
        userCitations = await storage.getAllCitations();
        userCitations = userCitations.filter((c) => c.issuedBy === req.session.user.id);
      } else {
        userCitations = await db.select().from(citations).where(eq(citations.issuedBy, req.session.user.id)).orderBy(desc(citations.createdAt));
      }
      res.json({ citations: userCitations });
    } catch (error) {
      console.error("Error fetching citations:", error);
      res.status(500).json({ message: "Failed to fetch citations" });
    }
  });
  app2.post("/api/arrests", requireAuth, async (req, res) => {
    try {
      const formData = req.body;
      const transformedData = {
        ...formData,
        // Map form fields to database fields
        arresteeUsername: formData.suspectSignature || "",
        arresteeSignature: formData.suspectSignature || "",
        mugshot: formData.mugshotBase64 || "",
        // Use empty string instead of null
        // Keep required fields from form data
        suspectSignature: formData.suspectSignature || "",
        officerSignatures: formData.officerSignatures || [],
        courtLocation: formData.courtLocation || "4000 Capitol Drive, Greenville, Wisconsin 54942",
        courtDate: formData.courtDate || "XX/XX/XX",
        courtPhone: formData.courtPhone || "(262) 785-4700 ext. 7",
        // Add the issuedBy field for validation
        issuedBy: req.session.user.id,
        // Remove only the files/base64 fields
        mugshotFile: void 0,
        mugshotBase64: void 0
      };
      const validatedData = insertArrestSchema.parse(transformedData);
      let arrestData = {
        ...validatedData,
        id: nanoid(),
        issuedBy: req.session.user.id,
        arrestedBy: req.session.user.id,
        // Add arrestedBy field for storage compatibility
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      let discordMessageId = null;
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;
        if (discordBotToken && discordChannelId) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          const PENAL_CODE_OPTIONS = [
            // Section 1 - Criminal/Violence
            { code: "(1)01", description: "Criminal Threats", amount: "3750.00", jailTime: "60 Seconds" },
            { code: "(1)02", description: "Assault", amount: "3750.00", jailTime: "240 Seconds" },
            { code: "(1)03", description: "Assault with a Deadly Weapon", amount: "10000.00", jailTime: "120 Seconds" },
            { code: "(1)04", description: "Battery", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(1)05", description: "Aggravated Battery", amount: "0.00", jailTime: "120 Seconds" },
            { code: "(1)06", description: "Attempted Murder", amount: "10000.00", jailTime: "240 Seconds" },
            { code: "(1)07", description: "Manslaughter", amount: "0.00", jailTime: "270 Seconds" },
            { code: "(1)08", description: "Murder", amount: "0.00", jailTime: "600 Seconds" },
            { code: "(1)09", description: "False Imprisonment", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(1)10", description: "Kidnapping", amount: "0.00", jailTime: "210 Seconds" },
            { code: "(1)11", description: "Domestic Violence", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(1)12", description: "Domestic Violence (Physical Traumatic Injury)", amount: "10000.00", jailTime: "120 Seconds" },
            { code: "(1)13", description: "Assault on a Public Servant", amount: "1000.00", jailTime: "120 Seconds" },
            { code: "(1)14", description: "Attempted Assault on a Public Servant", amount: "1000.00", jailTime: "100 Seconds" },
            { code: "(1)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },
            // Section 2 - Property Crimes
            { code: "(2)01", description: "Arson", amount: "0.00", jailTime: "210 Seconds" },
            { code: "(2)02", description: "Trespassing", amount: "1000.00", jailTime: "15 Seconds" },
            { code: "(2)03", description: "Trespassing within a Restricted Facility", amount: "10000.00", jailTime: "60 Seconds" },
            { code: "(2)04", description: "Burglary", amount: "0.00", jailTime: "150 Seconds" },
            { code: "(2)05", description: "Possession of Burglary Tools", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(2)06", description: "Robbery", amount: "0.00", jailTime: "150 Seconds" },
            { code: "(2)07", description: "Armed Robbery", amount: "0.00", jailTime: "390 Seconds" },
            { code: "(2)08", description: "Petty Theft", amount: "1000.00", jailTime: "None" },
            { code: "(2)09", description: "Grand Theft", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(2)10", description: "Grand Theft Auto", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(2)11", description: "Receiving Stolen Property", amount: "10000.00", jailTime: "90 Seconds" },
            { code: "(2)12", description: "Extortion", amount: "10000.00", jailTime: "120 Seconds" },
            { code: "(2)13", description: "Forgery / Fraud", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(2)14", description: "Vandalism", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(2)15", description: "Loitering", amount: "1000.00", jailTime: "None" },
            { code: "(2)16", description: "Destruction of Civilian Property", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(2)17", description: "Destruction of Government Property", amount: "10000.00", jailTime: "120 Seconds" },
            // Section 3 - Public Order
            { code: "(3)01", description: "Lewd or Dissolute Conduct in Public", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(3)02", description: "Stalking", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(3)03", description: "Public Urination", amount: "0.00", jailTime: "120 Seconds" },
            { code: "(3)04", description: "Public Defecation", amount: "0.00", jailTime: "120 Seconds" },
            // Section 4 - Government/Law Enforcement
            { code: "(4)01", description: "Bribery", amount: "10000.00", jailTime: "120 Seconds" },
            { code: "(4)02", description: "Dissuading a Victim", amount: "0.00", jailTime: "60 Seconds" },
            { code: "(4)03", description: "False Information to a Peace Officer", amount: "0.00", jailTime: "30 Seconds" },
            { code: "(4)04", description: "Filing a False Police Report", amount: "0.00", jailTime: "60 Seconds" },
            { code: "(4)05", description: "Failure to Identify to a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(4)06", description: "Impersonation of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(4)07", description: "Obstruction of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(4)08", description: "Resisting a Peace Officer", amount: "1000.00", jailTime: "120 Seconds" },
            { code: "(4)09", description: "Escape from Custody", amount: "1000.00", jailTime: "210 Seconds" },
            { code: "(4)10", description: "Prisoner Breakout", amount: "10000.00", jailTime: "90 Seconds" },
            { code: "(4)11", description: "Misuse of Government Hotline", amount: "1000.00", jailTime: "None" },
            { code: "(4)12", description: "Tampering with Evidence", amount: "1000.00", jailTime: "None" },
            { code: "(4)13", description: "Introduction of Contraband", amount: "0.00", jailTime: "120 Seconds" },
            { code: "(4)14", description: "False Arrest", amount: "10000.00", jailTime: "120 Seconds" },
            { code: "(4)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },
            { code: "(4)16", description: "Obstruction of Justice", amount: "500.00", jailTime: "60 Seconds" },
            { code: "(4)17", description: "Disorderly Conduct", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(4)18", description: "Failure to Comply with a Lawful Order", amount: "500.00", jailTime: "60 Seconds" },
            { code: "(4)19", description: "Aiding and Abetting", amount: "0.00", jailTime: "90 Seconds" },
            // Section 5 - Public Disturbance
            { code: "(5)01", description: "Disturbing the Peace", amount: "500.00", jailTime: "None" },
            { code: "(5)02", description: "Unlawful Assembly", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(5)03", description: "Inciting Riot", amount: "1000.00", jailTime: "120 Seconds" },
            // Section 6 - Drug Related
            { code: "(6)04", description: "Maintaining a Place for the Purpose of Distribution", amount: "10000.00", jailTime: "90 Seconds" },
            { code: "(6)05", description: "Manufacture of a Controlled Substance", amount: "50000.00", jailTime: "180 Seconds" },
            { code: "(6)06", description: "Sale of a Controlled Substance", amount: "5000.00", jailTime: "180 Seconds" },
            { code: "(6)08", description: "Under the Influence of a Controlled Substance", amount: "2000.00", jailTime: "180 Seconds" },
            { code: "(6)09", description: "Detention of Mentally Disordered Persons", amount: "0.00", jailTime: "180 Seconds" },
            // Section 7 - Animal/Child
            { code: "(7)01", description: "Animal Abuse / Cruelty", amount: "20000.00", jailTime: "90 Seconds" },
            { code: "(7)04", description: "Child Endangerment", amount: "10000.00", jailTime: "60 Seconds" },
            // Section 8 - Traffic Violations
            { code: "(8)01", description: "Invalid / No Vehicle Registration / Insurance", amount: "200.00", jailTime: "None" },
            { code: "(8)02", description: "Driving Without a License", amount: "1000.00", jailTime: "None" },
            { code: "(8)03", description: "Driving With a Suspended or Revoked License", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(8)04", description: "Accident Reporting Requirements - Property Damage", amount: "1000.00", jailTime: "None" },
            { code: "(8)05", description: "Accident Reporting Requirements - Injury or Death", amount: "10000.00", jailTime: "120 Seconds" },
            { code: "(8)06", description: "Failure to Obey Traffic Signal", amount: "250.00", jailTime: "None" },
            { code: "(8)07", description: "Driving Opposite Direction", amount: "500.00", jailTime: "None" },
            { code: "(8)08", description: "Failure to Maintain Lane", amount: "250.00", jailTime: "None" },
            { code: "(8)09", description: "Unsafe Following Distance", amount: "250.00", jailTime: "None" },
            { code: "(8)10", description: "Failure to Yield to Civilian", amount: "250.00", jailTime: "None" },
            { code: "(8)11", description: "Failure to Yield to Emergency Vehicles", amount: "250.00", jailTime: "None" },
            { code: "(8)12", description: "Unsafe Turn", amount: "250.00", jailTime: "None" },
            { code: "(8)13", description: "Unsafe Lane Change", amount: "250.00", jailTime: "None" },
            { code: "(8)14", description: "Illegal U-Turn", amount: "250.00", jailTime: "None" },
            { code: "(8)15", description: "Speeding (5-15 MPH Over)", amount: "250.00", jailTime: "None" },
            { code: "(8)16", description: "Speeding (16-25 MPH Over)", amount: "360.00", jailTime: "None" },
            { code: "(8)17", description: "Speeding (26+ MPH Over)", amount: "500.00", jailTime: "None" },
            { code: "(8)18", description: "Felony Speeding (100 MPH+)", amount: "5000.00", jailTime: "30 Seconds" },
            { code: "(8)19", description: "Unreasonably Slow / Stopped", amount: "250.00", jailTime: "None" },
            { code: "(8)20", description: "Failure to Obey Stop Sign / RED LIGHT", amount: "250.00", jailTime: "None" },
            { code: "(8)21", description: "Illegally Parked", amount: "250.00", jailTime: "None" },
            { code: "(8)22", description: "Reckless Driving", amount: "1000.00", jailTime: "30 Seconds" },
            { code: "(8)23", description: "Street Racing", amount: "1000.00", jailTime: "30 Seconds" },
            { code: "(8)24", description: "Throwing Objects", amount: "1000.00", jailTime: "None" },
            { code: "(8)25", description: "Operating While Intoxicated", amount: "2000.00", jailTime: "60 Seconds" },
            { code: "(8)26", description: "Evading a Peace Officer", amount: "0.00", jailTime: "270 Seconds" },
            { code: "(8)29", description: "Felony Evading a Peace Officer", amount: "0.00", jailTime: "300 Seconds" },
            { code: "(8)30", description: "Road Rage", amount: "0.00", jailTime: "30 Seconds" },
            { code: "(8)31", description: "Littering", amount: "1000.00", jailTime: "None" },
            { code: "(8)32", description: "Unsafe Speed for Conditions", amount: "2000.00", jailTime: "None" },
            { code: "(8)33", description: "Hogging Passing Lane", amount: "250.00", jailTime: "None" },
            { code: "(8)34", description: "Impeding Traffic", amount: "250.00", jailTime: "None" },
            { code: "(8)35", description: "Jaywalking", amount: "250.00", jailTime: "None" },
            { code: "(8)36", description: "Unnecessary Use of Horn", amount: "400.00", jailTime: "None" },
            { code: "(8)37", description: "Excessive Music / Engine Sounds", amount: "400.00", jailTime: "None" },
            { code: "(8)38", description: "Failure to Sign Citation", amount: "250.00", jailTime: "30 Seconds" },
            { code: "(8)39", description: "Failure to Yield to Pedestrian", amount: "250.00", jailTime: "None" },
            { code: "(8)40", description: "Distracted Driving", amount: "1000.00", jailTime: "None" },
            { code: "(8)41", description: "Driving on Shoulder / Emergency Lane", amount: "250.00", jailTime: "None" },
            { code: "(8)42", description: "Move Over Law", amount: "1000.00", jailTime: "None" },
            { code: "(8)43", description: "Driving Without Headlights", amount: "250.00", jailTime: "None" },
            { code: "(8)44", description: "Hit and Run", amount: "500.00", jailTime: "None" },
            { code: "(8)45", description: "Attempted Vehicular Manslaughter", amount: "750.00", jailTime: "60 Seconds" },
            { code: "(8)46", description: "Vehicular Manslaughter", amount: "750.00", jailTime: "120 Seconds" },
            { code: "(8)47", description: "Reckless Evasion", amount: "750.00", jailTime: "120 Seconds" },
            { code: "(8)48", description: "Possession of a Stolen Vehicle", amount: "0.00", jailTime: "120 Seconds" },
            { code: "(8)49", description: "Reckless Endangerments", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(8)50", description: "Unroadworthy Vehicle", amount: "1000.00", jailTime: "None" },
            { code: "(8)51", description: "Drifting on a Public Road", amount: "250.00", jailTime: "None" },
            { code: "(8)52", description: "Failure to Control Vehicle", amount: "250.00", jailTime: "None" },
            { code: "(8)53", description: "Unsafe Parking (Parking Ticket)", amount: "100.00", jailTime: "None" },
            { code: "(8)54", description: "Failure to Use Turn Signal", amount: "100.00", jailTime: "None" },
            { code: "(8)55", description: "Failure to Display License Plate (W/ only)", amount: "300.00", jailTime: "None" },
            // Section 9 - Weapons
            { code: "(9)01", description: "Possession of an Illegal Weapon", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(9)02", description: "Brandishing a Firearm", amount: "1000.00", jailTime: "60 Seconds" },
            { code: "(9)03", description: "Illegal Discharge of a Firearm", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(9)04", description: "Unlicensed Possession of a Firearm", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(9)05", description: "Possession of a Stolen Weapon", amount: "0.00", jailTime: "90 Seconds" },
            { code: "(9)06", description: "Unlawful Distribution of a Firearm", amount: "0.00", jailTime: "90 Seconds" }
          ];
          const penalCodeDescriptions = formData.penalCodes.map((code, index) => {
            const amount = formData.amountsDue[index];
            const jailTime = formData.jailTimes[index];
            const codeOption = PENAL_CODE_OPTIONS.find((option) => option.code === code);
            const description = codeOption ? codeOption.description : code;
            return `**${code}** - **${description}** - **${jailTime}** - **$${amount}**`;
          }).join("\n");
          discordMessageId = await discordBot.sendArrestReport(formData);
          console.log("\u2705 Arrest report sent to Discord successfully, message ID:", discordMessageId);
          arrestData = { ...arrestData, discordMessageId };
        } else {
          console.log("\u26A0\uFE0F Discord bot credentials not configured, arrest saved locally only");
        }
      } catch (discordError) {
        console.error("\u274C Failed to send arrest report to Discord:", discordError);
      }
      if (useFileStorage) {
        await storage.saveArrest(arrestData);
      } else {
        await db.insert(arrests).values(arrestData);
      }
      res.json({
        message: "Arrest record created successfully",
        arrest: arrestData
      });
    } catch (error) {
      console.error("Arrest creation error:", error);
      if (error.name === "ZodError") {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({
          message: "Invalid arrest data",
          errors: error.errors,
          details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        });
      }
      res.status(500).json({ message: "Failed to create arrest record" });
    }
  });
  app2.get("/api/arrests", requireAuth, async (req, res) => {
    try {
      let userArrests;
      if (useFileStorage) {
        userArrests = await storage.getAllArrests();
        userArrests = userArrests.filter((a) => a.issuedBy === req.session.user.id);
      } else {
        userArrests = await db.select().from(arrests).where(eq(arrests.issuedBy, req.session.user.id)).orderBy(desc(arrests.createdAt));
      }
      res.json({ arrests: userArrests });
    } catch (error) {
      console.error("Error fetching arrests:", error);
      res.status(500).json({ message: "Failed to fetch arrests" });
    }
  });
  app2.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      res.json(users2);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const citationCount = await storage.getCitationCount();
      const arrestCount = await storage.getArrestCount();
      const users2 = await storage.getAllUsers();
      const userCount = users2.length;
      res.json({
        userCount,
        citationCount,
        arrestCount,
        adminCount: users2.filter((u) => u.isAdmin === "true").length
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
  app2.get("/api/admin/citations", requireAuth, requireAdmin, async (req, res) => {
    try {
      const citations2 = await storage.getAllCitations();
      res.json(citations2.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Error fetching citations:", error);
      res.status(500).json({ message: "Failed to fetch citations" });
    }
  });
  app2.get("/api/admin/arrests", requireAuth, requireAdmin, async (req, res) => {
    try {
      const arrests2 = await storage.getAllArrests();
      res.json(arrests2.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Error fetching arrests:", error);
      res.status(500).json({ message: "Failed to fetch arrests" });
    }
  });
  app2.get("/api/admin/blocked-usernames", requireAuth, requireAdmin, async (req, res) => {
    try {
      const blockedUsernames = await storage.getBlockedUsernames();
      res.json(blockedUsernames);
    } catch (error) {
      console.error("Error fetching blocked usernames:", error);
      res.status(500).json({ message: "Failed to fetch blocked usernames" });
    }
  });
  app2.post("/api/admin/blocked-usernames", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      await storage.blockUsername(username);
      res.json({ message: "Username blocked successfully" });
    } catch (error) {
      console.error("Error blocking username:", error);
      res.status(500).json({ message: "Failed to block username" });
    }
  });
  app2.delete("/api/admin/blocked-usernames/:username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      await storage.unblockUsername(username);
      res.json({ message: "Username unblocked successfully" });
    } catch (error) {
      console.error("Error unblocking username:", error);
      res.status(500).json({ message: "Failed to unblock username" });
    }
  });
  app2.put("/api/admin/users/:id/admin", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isAdmin } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.username.toLowerCase() === "popfork1" || user.id === req.session.user?.id) {
        return res.status(403).json({ message: "Cannot modify protected user" });
      }
      await storage.updateUserAdmin(userId, isAdmin);
      if (userId === req.session.user?.id) {
        req.session.user = { ...req.session.user, isAdmin };
      }
      res.json({ message: "User admin status updated successfully" });
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ message: "Failed to update user admin status" });
    }
  });
  app2.post("/api/admin/terminated-usernames", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      if (username.toLowerCase() === "popfork1" || username.toLowerCase() === req.session.user?.username.toLowerCase()) {
        return res.status(403).json({ message: "Cannot terminate protected user" });
      }
      await storage.terminateUsername(username);
      res.json({ message: "Username terminated successfully" });
    } catch (error) {
      console.error("Error terminating username:", error);
      res.status(500).json({ message: "Failed to terminate username" });
    }
  });
  app2.get("/api/admin/terminated-usernames", requireAuth, requireAdmin, async (req, res) => {
    try {
      const terminatedUsernames = await storage.getTerminatedUsernames();
      res.json(terminatedUsernames);
    } catch (error) {
      console.error("Error fetching terminated usernames:", error);
      res.status(500).json({ message: "Failed to fetch terminated usernames" });
    }
  });
  app2.delete("/api/admin/terminated-usernames/:username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      await storage.unterminateUsername(username);
      res.json({ message: "Username unterminated successfully" });
    } catch (error) {
      console.error("Error unterminating username:", error);
      res.status(500).json({ message: "Failed to unterminate username" });
    }
  });
  app2.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.username.toLowerCase() === "popfork1" || user.id === req.session.user?.id) {
        return res.status(403).json({ message: "Cannot delete protected user" });
      }
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  app2.delete("/api/admin/citations/all", requireAuth, requireAdmin, async (req, res) => {
    try {
      let deletedCount = 0;
      let citations2 = [];
      if (useFileStorage) {
        citations2 = await storage.getAllCitations();
        deletedCount = citations2.length;
        await storage.deleteAllCitations();
      } else {
        const result = await db.delete(citations2);
        deletedCount = result.rowCount || 0;
      }
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;
        if (discordBotToken && discordChannelId && citations2.length > 0) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          for (const citation of citations2) {
            if (citation.discordMessageId) {
              try {
                await discordBot.deleteMessage(citation.discordMessageId);
              } catch (error) {
                console.error(`Failed to delete Discord message ${citation.discordMessageId}:`, error);
              }
            }
          }
        }
      } catch (discordError) {
        console.error("Failed to delete some Discord messages:", discordError);
      }
      res.json({
        message: `Successfully deleted ${deletedCount} citations`,
        deletedCount
      });
    } catch (error) {
      console.error("Delete all citations error:", error);
      res.status(500).json({ message: "Failed to delete citations" });
    }
  });
  app2.delete("/api/admin/arrests/all", requireAuth, requireAdmin, async (req, res) => {
    try {
      let deletedCount = 0;
      let arrestsList = [];
      if (useFileStorage) {
        arrestsList = await storage.getAllArrests();
        deletedCount = arrestsList.length;
        await storage.deleteAllArrests();
      } else {
        const result = await db.delete(arrests);
        deletedCount = result.rowCount || 0;
      }
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;
        if (discordBotToken && discordChannelId && arrestsList.length > 0) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          for (const arrest of arrestsList) {
            if (arrest.discordMessageId) {
              try {
                await discordBot.deleteMessage(arrest.discordMessageId);
              } catch (error) {
                console.error(`Failed to delete Discord message ${arrest.discordMessageId}:`, error);
              }
            }
          }
        }
      } catch (discordError) {
        console.error("Failed to delete some Discord messages:", discordError);
      }
      res.json({
        message: `Successfully deleted ${deletedCount} arrests`,
        deletedCount
      });
    } catch (error) {
      console.error("Delete all arrests error:", error);
      res.status(500).json({ message: "Failed to delete arrests" });
    }
  });
  app2.delete("/api/admin/citations/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const citationId = req.params.id;
      const citations2 = await storage.getAllCitations();
      const citation = citations2.find((c) => c.id === citationId);
      if (!citation) {
        return res.status(404).json({ message: "Citation not found" });
      }
      if (citation.discordMessageId) {
        try {
          const discordService = createDiscordBotService(
            process.env.DISCORD_BOT_TOKEN || "",
            process.env.DISCORD_CHANNEL_ID || ""
          );
          await discordService.deleteMessage(citation.discordMessageId);
        } catch (discordError) {
          console.error("Error deleting Discord message:", discordError);
        }
      }
      await storage.deleteCitation(citationId);
      res.json({ message: "Citation deleted successfully" });
    } catch (error) {
      console.error("Error deleting citation:", error);
      res.status(500).json({ message: "Failed to delete citation" });
    }
  });
  app2.delete("/api/admin/arrests/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const arrestId = req.params.id;
      const arrests2 = await storage.getAllArrests();
      const arrest = arrests2.find((a) => a.id === arrestId);
      if (!arrest) {
        return res.status(404).json({ message: "Arrest not found" });
      }
      if (arrest.discordMessageId) {
        try {
          const discordService = createDiscordBotService(
            process.env.DISCORD_BOT_TOKEN || "",
            process.env.DISCORD_CHANNEL_ID || ""
          );
          await discordService.deleteMessage(arrest.discordMessageId);
        } catch (discordError) {
          console.error("Error deleting Discord message:", discordError);
        }
      }
      await storage.deleteArrest(arrestId);
      res.json({ message: "Arrest deleted successfully" });
    } catch (error) {
      console.error("Error deleting arrest:", error);
      res.status(500).json({ message: "Failed to delete arrest" });
    }
  });
  app2.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { discordUsername } = req.body;
      if (!discordUsername) {
        return res.status(400).json({ message: "Discord username is required" });
      }
      let user;
      if (useFileStorage) {
        const allUsers = await storage.getAllUsers();
        user = allUsers.find(
          (u) => u.username?.toLowerCase() === discordUsername.toLowerCase() || u.discordId === discordUsername || u.rpName?.toLowerCase() === discordUsername.toLowerCase()
        );
      } else {
        const result = await db.select().from(users).where(
          or(
            eq(users.username, discordUsername),
            eq(users.discordId, discordUsername),
            eq(users.rpName, discordUsername)
          )
        ).limit(1);
        user = result[0];
      }
      if (!user || !user.discordId) {
        return res.status(404).json({ message: "User not found or Discord ID not linked" });
      }
      const resetToken = nanoid(32);
      const resetCode = nanoid(32);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1e3);
      req.session.passwordReset = {
        token: resetToken,
        code: resetCode,
        userId: user.id,
        expiresAt: expiresAt.toISOString()
      };
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        if (discordBotToken) {
          const discordBot = createDiscordBotService(discordBotToken, "");
          await discordBot.sendPasswordResetCode(user.discordId, resetCode);
          console.log("\u2705 Password reset code sent to Discord successfully");
        } else {
          console.log("\u26A0\uFE0F Discord bot token not configured");
          return res.status(500).json({ message: "Discord messaging not configured" });
        }
      } catch (discordError) {
        console.error("\u274C Failed to send reset code to Discord:", discordError);
        return res.status(500).json({ message: "Failed to send reset code to Discord" });
      }
      res.json({
        message: "Reset code sent to your Discord DM",
        resetToken
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });
  app2.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { resetToken, resetCode, newPassword } = req.body;
      if (!resetToken || !resetCode || !newPassword) {
        return res.status(400).json({ message: "Reset token, code, and new password are required" });
      }
      const resetData = req.session.passwordReset;
      if (!resetData || resetData.token !== resetToken || resetData.code !== resetCode) {
        return res.status(400).json({ message: "Invalid reset token or code" });
      }
      if (/* @__PURE__ */ new Date() > new Date(resetData.expiresAt)) {
        delete req.session.passwordReset;
        return res.status(400).json({ message: "Reset code has expired" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      if (useFileStorage) {
        await storage.updateUserPassword(resetData.userId, hashedPassword);
      } else {
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, resetData.userId));
      }
      delete req.session.passwordReset;
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  return app2;
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path4 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path3 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path3.resolve(import.meta.dirname, "client", "src"),
      "@shared": path3.resolve(import.meta.dirname, "shared"),
      "@assets": path3.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path3.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path3.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    historyApiFallback: true
  }
});

// server/vite.ts
import { nanoid as nanoid2 } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path4.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}

// server/index.ts
var app = express2();
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "your-secret-key-here",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    // Always false for now to fix session issues
    httpOnly: true,
    maxAge: 1e3 * 60 * 60 * 24 * 7,
    // 7 days
    sameSite: "lax"
    // Add sameSite for better compatibility
  }
}));
app.use((req, res, next) => {
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${req.method} ${req.url}`);
  console.log("Session ID:", req.sessionID);
  console.log("Session data:", JSON.stringify(req.session, null, 2));
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    app.use(express2.static(path5.resolve("dist/public")));
  }
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (app.get("env") === "development") {
      return next();
    } else {
      res.sendFile(path5.resolve("dist/public/index.html"));
    }
  });
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
