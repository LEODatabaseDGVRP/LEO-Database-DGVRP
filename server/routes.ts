import type { Express } from "express";
import { db } from "./db";
import { insertUserSchema, selectUserSchema, insertCitationSchema, selectCitationSchema, insertArrestSchema, selectArrestSchema, signUpSchema, loginSchema, type SelectUser, type InsertUser, type SelectCitation, type InsertCitation, type SelectArrest, type InsertArrest } from "../shared/schema";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { users, citations, arrests } from "./db";
import { createDiscordBotService } from "./discord";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { getRandomSystemUsername, createDiscordBotService } from "./discord";
import { getDiscordAuthUrl, handleDiscordCallback } from "./discord-oauth";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we have a proper database connection
let useFileStorage = false;
try {
  // Test if the database is properly configured
  await db.select().from(users).limit(1);
  console.log("Database connected successfully");
} catch (error) {
  console.log("Database not available, using file storage");
  useFileStorage = true;
}

export function registerRoutes(app: Express) {

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  // Admin middleware
  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.session?.user?.isAdmin !== true) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt with data:", req.body);
      const validatedData = loginSchema.parse(req.body);
      console.log("Validated data:", validatedData);

      // Check if username is terminated first
      if (useFileStorage) {
        const isTerminated = await storage.isUsernameTerminated(validatedData.username);
        console.log("Username terminated check:", isTerminated);
        if (isTerminated) {
          return res.status(401).json({ message: "This account has been terminated" });
        }
      }

      let user;
      if (useFileStorage) {
        // Get user directly without termination check since we already checked above
        const allUsers = await storage.getAllUsers();
        console.log("All users found:", allUsers.length);
        user = allUsers.find(u => u.username.toLowerCase() === validatedData.username.toLowerCase());
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

      // Set session
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

      // Force session save
      req.session.save((err: any) => {
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

  app.post("/api/auth/signup", async (req, res) => {
    try {
      console.log("=== SIGNUP REQUEST DEBUG ===");
      console.log("Raw request body:", JSON.stringify(req.body, null, 2));
      console.log("Request headers:", req.headers);
      console.log("Session data:", JSON.stringify(req.session, null, 2));

      // Temporary backward compatibility - handle both old and new field names
      if (req.body.fullName && !req.body.rpName) {
        req.body.rpName = req.body.fullName;
        console.log("Applied backward compatibility: fullName -> rpName");
      }

      const validatedData = signUpSchema.parse(req.body);
      console.log("Validation successful, validated data:", JSON.stringify(validatedData, null, 2));

      // Check if Discord verification is required and available
      const discordVerification = (req.session as any)?.discordVerified;
      if (!discordVerification) {
        return res.status(400).json({
          message: "Discord verification required. Please complete Discord authentication first."
        });
      }

      validatedData.discordId = discordVerification.id;

      // Ensure username existence
      if (!validatedData.username) {
        validatedData.username = discordVerification.username;
      }

      console.log("Username for signup:", validatedData.username);

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Check if user already exists
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

      // Create user
      const userData = {
        username: validatedData.username,
        password: hashedPassword,
        badgeNumber: validatedData.badgeNumber,
        isAdmin: "false",
        rpName: validatedData.rpName,
        rank: validatedData.rank,
        callsign: validatedData.callsign,
        discordId: discordVerification.id,
      };

      let createdUser;
      if (useFileStorage) {
        createdUser = await storage.createUser(userData);
      } else {
        const result = await db.insert(users).values(userData).returning();
        createdUser = result[0];
      }

      // Clear the Discord verification from session
      delete (req.session as any).discordVerified;

      // Set session
      req.session.user = {
        id: createdUser.id,
        username: createdUser.username,
        badgeNumber: createdUser.badgeNumber,
        fullName: createdUser.rpName || createdUser.username,
        department: "Police Department",
        rank: createdUser.rank || "Officer",
        callsign: createdUser.callsign || "",
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
    } catch (error: any) {
      console.error("=== SIGNUP ERROR DEBUG ===");
      console.error("Error type:", error.constructor.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      if (error.name === 'ZodError') {
        console.error("Zod validation errors:", JSON.stringify(error.errors, null, 2));
        const errorDetails = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
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

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
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

  app.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { rpName, rank, callsign, discordId, badgeNumber } = req.body;

      let updatedUser;
      if (useFileStorage) {
        updatedUser = await storage.updateUserProfile(req.session.user.id, {
          rpName,
          rank,
          callsign,
          discordId,
          badgeNumber
        });
      } else {
        const result = await db.update(users)
          .set({
            rpName,
            rank,
            callsign,
            discordId,
            badgeNumber
          })
          .where(eq(users.id, req.session.user.id))
          .returning();
        updatedUser = result[0];
      }

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update session with new profile data
      req.session.user = {
        ...req.session.user,
        badgeNumber: updatedUser.badgeNumber,
        fullName: updatedUser.rpName || updatedUser.username,
        rank: updatedUser.rank || "Officer",
        callsign: updatedUser.callsign || "",
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

  // Discord OAuth routes
  app.get("/api/auth/discord", (req, res) => {
    const { mode } = req.query;
    const discordAuthUrl = getDiscordAuthUrl(mode as string);
    res.json({ url: discordAuthUrl });
  });

  app.get("/api/auth/discord/url", (req, res) => {
    const { mode } = req.query;
    const discordAuthUrl = getDiscordAuthUrl(mode as string || 'signup');
    res.json({ url: discordAuthUrl });
  });

  app.get("/api/auth/discord/status", (req, res) => {
    const discordVerified = (req.session as any)?.discordVerified;
    res.json({ verified: !!discordVerified, user: discordVerified });
  });

  app.get("/api/auth/discord/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({ message: "Missing code or state" });
      }

      const result = await handleDiscordCallback(code as string, state as string);

      // Store Discord user info in session for signup/login
      (req.session as any).discordVerified = {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName || result.user.username,
        discriminator: result.user.discriminator || '0000',
        verifiedAt: new Date().toISOString()
      };

      // Save the session before redirecting
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
        }
        // Always redirect to the Discord callback page which will handle the rest
        res.redirect('/discord-callback?verified=true');
      });
    } catch (error) {
      console.error("Discord callback error:", error);

      // Extract meaningful error message
      let errorMessage = 'discord_failed';
      if (error instanceof Error) {
        if (error.message.includes('required role')) {
          errorMessage = 'insufficient_role';
        } else if (error.message.includes('not a member')) {
          errorMessage = 'not_member';
        } else if (error.message.includes('Failed to authenticate')) {
          errorMessage = 'auth_failed';
        }
      }

      res.redirect(`/discord-callback?error=${errorMessage}`);
    }
  });

  app.post("/api/auth/discord/disconnect", (req, res) => {
    try {
      // Remove Discord verification from session
      if (req.session) {
        delete (req.session as any).discordVerified;
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

  // Citation routes
  app.post("/api/citations", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCitationSchema.parse(req.body);

      let citationData = {
        ...validatedData,
        id: nanoid(),
        issuedBy: req.session.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Send citation to Discord bot first to get message ID
      let discordMessageId = null;
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;

        if (discordBotToken && discordChannelId) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          discordMessageId = await discordBot.sendCitationReport(citationData);
          console.log("✅ Citation sent to Discord successfully, message ID:", discordMessageId);

          // Add Discord message ID to citation data
          citationData = { ...citationData, discordMessageId };
        } else {
          console.log("⚠️ Discord bot credentials not configured, citation saved locally only");
        }
      } catch (discordError) {
        console.error("❌ Failed to send citation to Discord:", discordError);
        // Continue without Discord message ID
      }

      // Save citation with Discord message ID (if available)
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

  app.get("/api/citations", requireAuth, async (req, res) => {
    try {
      let userCitations;
      if (useFileStorage) {
        userCitations = await storage.getAllCitations();
        userCitations = userCitations.filter(c => c.issuedBy === req.session.user.id);
      } else {
        userCitations = await db.select().from(citations).where(eq(citations.issuedBy, req.session.user.id)).orderBy(desc(citations.createdAt));
      }

      res.json({ citations: userCitations });
    } catch (error) {
      console.error("Error fetching citations:", error);
      res.status(500).json({ message: "Failed to fetch citations" });
    }
  });

  // Shift log routes
  app.post("/api/shift-logs", requireAuth, async (req, res) => {
    try {
      const formData = req.body;

      // Send shift log to Discord bot
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_SHIFT_LOG_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;

        if (discordBotToken && discordChannelId) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          await discordBot.sendShiftLog(formData);
          console.log("✅ Shift log sent to Discord successfully");
        } else {
          console.log("⚠️ Discord bot credentials not configured for shift logs");
        }
      } catch (discordError) {
        console.error("❌ Failed to send shift log to Discord:", discordError);
        // Continue without Discord - we still want to respond successfully
      }

      res.json({ 
        message: "Shift log submitted successfully"
      });
    } catch (error) {
      console.error("Shift log creation error:", error);
      res.status(500).json({ message: "Failed to submit shift log" });
    }
  });

  // Arrest routes
  app.post("/api/arrests", requireAuth, async (req, res) => {
    try {
      // Transform form data to match database schema
      const formData = req.body;
      const transformedData = {
        ...formData,
        // Map form fields to database fields
        arresteeUsername: formData.suspectSignature || "",
        arresteeSignature: formData.suspectSignature || "",
        mugshot: formData.mugshotBase64 || "", // Use empty string instead of null
        // Keep required fields from form data
        suspectSignature: formData.suspectSignature || "",
        officerSignatures: formData.officerSignatures || [],
        courtLocation: formData.courtLocation || "4000 Capitol Drive, Greenville, Wisconsin 54942",
        courtDate: formData.courtDate || "XX/XX/XX",
        courtPhone: formData.courtPhone || "(262) 785-4700 ext. 7",
        // Add the issuedBy field for validation
        issuedBy: req.session.user.id,
        // Remove only the files/base64 fields
        mugshotFile: undefined,
        mugshotBase64: undefined
      };

      const validatedData = insertArrestSchema.parse(transformedData);

      let arrestData = {
        ...validatedData,
        id: nanoid(),
        issuedBy: req.session.user.id,
        arrestedBy: req.session.user.id, // Add arrestedBy field for storage compatibility
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Send arrest report to Discord bot first to get message ID
      let discordMessageId = null;
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;

        if (discordBotToken && discordChannelId) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          // Use original form data for Discord which has more fields

          discordMessageId = await discordBot.sendArrestReport(formData);
          console.log("✅ Arrest report sent to Discord successfully, message ID:", discordMessageId);

          // Add Discord message ID to arrest data
          arrestData = { ...arrestData, discordMessageId };
        } else {
          console.log("⚠️ Discord bot credentials not configured, arrest saved locally only");
        }
      } catch (discordError) {
        console.error("❌ Failed to send arrest report to Discord:", discordError);
        // Continue without Discord message ID
      }

      // Save arrest with Discord message ID (if available)
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
      if (error.name === 'ZodError') {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({
          message: "Invalid arrest data",
          errors: error.errors,
          details: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      res.status(500).json({ message: "Failed to create arrest record" });
    }
  });

  app.get("/api/arrests", requireAuth, async (req, res) => {
    try {
      let userArrests;
      if (useFileStorage) {
        userArrests = await storage.getAllArrests();
        userArrests = userArrests.filter(a => a.issuedBy === req.session.user.id);
      } else {
        userArrests = await db.select().from(arrests).where(eq(arrests.issuedBy, req.session.user.id)).orderBy(desc(arrests.createdAt));
      }

      res.json({ arrests: userArrests });
    } catch (error) {
      console.error("Error fetching arrests:", error);
      res.status(500).json({ message: "Failed to fetch arrests" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const citationCount = await storage.getCitationCount();
      const arrestCount = await storage.getArrestCount();
      const users = await storage.getAllUsers();
      const userCount = users.length;

      res.json({
        userCount,
        citationCount,
        arrestCount,
        adminCount: users.filter(u => u.isAdmin === "true").length
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/citations", requireAuth, requireAdmin, async (req, res) => {
    try {
      const citations = await storage.getAllCitations();
      res.json(citations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Error fetching citations:", error);
      res.status(500).json({ message: "Failed to fetch citations" });
    }
  });

  app.get("/api/admin/arrests", requireAuth, requireAdmin, async (req, res) => {
    try {
      const arrests = await storage.getAllArrests();
      res.json(arrests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Error fetching arrests:", error);
      res.status(500).json({ message: "Failed to fetch arrests" });
    }
  });

  app.get("/api/admin/blocked-usernames", requireAuth, requireAdmin, async (req, res) => {
    try {
      const blockedUsernames = await storage.getBlockedUsernames();
      res.json(blockedUsernames);
    } catch (error) {
      console.error("Error fetching blocked usernames:", error);
      res.status(500).json({ message: "Failed to fetch blocked usernames" });
    }
  });

  app.post("/api/admin/blocked-usernames", requireAuth, requireAdmin, async (req, res) => {
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

  app.delete("/api/admin/blocked-usernames/:username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      await storage.unblockUsername(username);
      res.json({ message: "Username unblocked successfully" });
    } catch (error) {
      console.error("Error unblocking username:", error);
      res.status(500).json({ message: "Failed to unblock username" });
    }
  });

  app.put("/api/admin/users/:id/admin", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isAdmin } = req.body;

      // Get user to check if protected
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Protect popfork1 and current user
      if (user.username.toLowerCase() === 'popfork1' || user.id === req.session.user?.id) {
        return res.status(403).json({ message: "Cannot modify protected user" });
      }

      await storage.updateUserAdmin(userId, isAdmin);

      // Update session if the current user's admin status is being changed
      if (userId === req.session.user?.id) {
        req.session.user = { ...req.session.user, isAdmin: isAdmin };
      }

      res.json({ message: "User admin status updated successfully" });
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ message: "Failed to update user admin status" });
    }
  });

  app.put("/api/admin/users/:id/rank", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { rank } = req.body;

      if (!rank || typeof rank !== 'string' || rank.trim().length === 0) {
        return res.status(400).json({ message: "Valid rank is required" });
      }

      // Get user to check if exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Protect popfork1 and current user from rank changes
      if (user.username.toLowerCase() === 'popfork1' || user.id === req.session.user?.id) {
        return res.status(403).json({ message: "Cannot modify protected user's rank" });
      }

      await storage.updateUserRank(userId, rank.trim());

      res.json({ message: "User rank updated successfully" });
    } catch (error) {
      console.error("Error updating user rank:", error);
      res.status(500).json({ message: "Failed to update user rank" });
    }
  });

  app.post("/api/admin/terminated-usernames", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;

      // Protect popfork1 and current user
      if (username.toLowerCase() === 'popfork1' || username.toLowerCase() === req.session.user?.username.toLowerCase()) {
        return res.status(403).json({ message: "Cannot terminate protected user" });
      }

      await storage.terminateUsername(username);
      res.json({ message: "Username terminated successfully" });
    } catch (error) {
      console.error("Error terminating username:", error);
      res.status(500).json({ message: "Failed to terminate username" });
    }
  });

  app.get("/api/admin/terminated-usernames", requireAuth, requireAdmin, async (req, res) => {
    try {
      const terminatedUsernames = await storage.getTerminatedUsernames();
      res.json(terminatedUsernames);
    } catch (error) {
      console.error("Error fetching terminated usernames:", error);
      res.status(500).json({ message: "Failed to fetch terminated usernames" });
    }
  });

  app.delete("/api/admin/terminated-usernames/:username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      await storage.unterminateUsername(username);
      res.json({ message: "Username unterminated successfully" });
    } catch (error) {
      console.error("Error unterminating username:", error);
      res.status(500).json({ message: "Failed to unterminate username" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Get user to check if protected
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Protect popfork1 and current user
      if (user.username.toLowerCase() === 'popfork1' || user.id === req.session.user?.id) {
        return res.status(403).json({ message: "Cannot delete protected user" });
      }

      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Delete all citations (must come before single citation delete)
  app.delete("/api/admin/citations/all", requireAuth, requireAdmin, async (req, res) => {
    try {
      let deletedCount = 0;
      let citations = [];

      if (useFileStorage) {
        citations = await storage.getAllCitations();
        deletedCount = citations.length;
        await storage.deleteAllCitations();
      } else {
        const result = await db.delete(citations);
        deletedCount = result.rowCount || 0;
      }

      // Try to delete Discord messages
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;

        if (discordBotToken && discordChannelId && citations.length > 0) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          for (const citation of citations) {
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

  // Delete all arrests (must come before single arrest delete)
  app.delete("/api/admin/arrests/all", requireAuth, requireAdmin, async (req, res) => {
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

      // Try to delete Discord messages
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

  app.delete("/api/admin/citations/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const citationId = req.params.id;

      // Get citation data first to get Discord message ID
      const citations = await storage.getAllCitations();
      const citation = citations.find(c => c.id === citationId);

      if (!citation) {
        return res.status(404).json({ message: "Citation not found" });
      }

      // Delete from Discord if message ID exists
      if (citation.discordMessageId) {
        try {
          const discordService = createDiscordBotService(
            process.env.DISCORD_BOT_TOKEN || '',
            process.env.DISCORD_CHANNEL_ID || ''
          );
          await discordService.deleteMessage(citation.discordMessageId);
        } catch (discordError) {
          console.error("Error deleting Discord message:", discordError);
          // Continue with database deletion even if Discord fails
        }
      }

      // Delete from storage
      await storage.deleteCitation(citationId);
      res.json({ message: "Citation deleted successfully" });
    } catch (error) {
      console.error("Error deleting citation:", error);
      res.status(500).json({ message: "Failed to delete citation" });
    }
  });

  app.delete("/api/admin/arrests/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const arrestId = req.params.id;

      // Get arrest data first to get Discord message ID
      const arrests = await storage.getAllArrests();
      const arrest = arrests.find(a => a.id === arrestId);

      if (!arrest) {
        return res.status(404).json({ message: "Arrest not found" });
      }

      // Delete from Discord if message ID exists
      if (arrest.discordMessageId) {
        try {
          const discordService = createDiscordBotService(
            process.env.DISCORD_BOT_TOKEN || '',
            process.env.DISCORD_CHANNEL_ID || ''
          );
          await discordService.deleteMessage(arrest.discordMessageId);
        } catch (discordError) {
          console.error("Error deleting Discord message:", discordError);
          // Continue with database deletion even if Discord fails
        }
      }

      // Delete from storage
      await storage.deleteArrest(arrestId);
      res.json({ message: "Arrest deleted successfully" });
    } catch (error) {
      console.error("Error deleting arrest:", error);
      res.status(500).json({ message: "Failed to delete arrest" });
    }
  });

  // Password reset routes
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { discordUsername } = req.body;

      if (!discordUsername) {
        return res.status(400).json({ message: "Discord username is required" });
      }

      // Find user by Discord username or ID
      let user;
      if (useFileStorage) {
        const allUsers = await storage.getAllUsers();
        user = allUsers.find(u => 
          u.username?.toLowerCase() === discordUsername.toLowerCase() || 
          u.discordId === discordUsername ||
          u.rpName?.toLowerCase() === discordUsername.toLowerCase()
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

      // Generate reset token and code
      const resetToken = nanoid(32);
      const resetCode = nanoid(32);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token in session
      req.session.passwordReset = {
        token: resetToken,
        code: resetCode,
        userId: user.id,
        expiresAt: expiresAt.toISOString()
      };

      // Send reset code via Discord DM
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;

        if (discordBotToken) {
          const discordBot = createDiscordBotService(discordBotToken, "");
          await discordBot.sendPasswordResetCode(user.discordId, resetCode);
          console.log("✅ Password reset code sent to Discord successfully");
        } else {
          console.log("⚠️ Discord bot token not configured");
          return res.status(500).json({ message: "Discord messaging not configured" });
        }
      } catch (discordError) {
        console.error("❌ Failed to send reset code to Discord:", discordError);
        return res.status(500).json({ message: "Failed to send reset code to Discord" });
      }

      res.json({ 
        message: "Reset code sent to your Discord DM",
        resetToken: resetToken
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { resetToken, resetCode, newPassword } = req.body;

      if (!resetToken || !resetCode || !newPassword) {
        return res.status(400).json({ message: "Reset token, code, and new password are required" });
      }

      // Verify reset token and code
      const resetData = req.session.passwordReset;
      if (!resetData || resetData.token !== resetToken || resetData.code !== resetCode) {
        return res.status(400).json({ message: "Invalid reset token or code" });
      }

      // Check if reset code has expired
      if (new Date() > new Date(resetData.expiresAt)) {
        delete req.session.passwordReset;
        return res.status(400).json({ message: "Reset code has expired" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      if (useFileStorage) {
        await storage.updateUserPassword(resetData.userId, hashedPassword);
      } else {
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, resetData.userId));
      }

      // Clear reset data from session
      delete req.session.passwordReset;

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}