import type { Express } from "express";
import { db } from "./db";
import { insertUserSchema, selectUserSchema, insertCitationSchema, selectCitationSchema, insertArrestSchema, selectArrestSchema, signUpSchema, loginSchema, type SelectUser, type InsertUser, type SelectCitation, type InsertCitation, type SelectArrest, type InsertArrest } from "../shared/schema";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { users, citations, arrests } from "./db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { getRandomSystemUsername, createDiscordBotService } from "./discord";
import { getDiscordAuthUrl, handleDiscordCallback } from "./discord-oauth";
import session from "express-session";
// import MemoryStore from "memorystore";
// const MemoryStore = require("memorystore")(session);

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize session store
// const store = new MemoryStore({
//   checkPeriod: 86400000, // prune expired entries every 24h
// });

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
  // Sessions middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    // store: store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  }));

  // Debug session middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', JSON.stringify(req.session, null, 2));
    next();
  });

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
      const validatedData = loginSchema.parse(req.body);
      
      let user;
      if (useFileStorage) {
        user = await storage.getUserByUsername(validatedData.username);
      } else {
        const result = await db.select().from(users).where(eq(users.username, validatedData.username)).limit(1);
        user = result[0];
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(validatedData.password, user.password);
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

      res.json({ 
        message: "Login successful",
        user: req.session.user
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      console.log("Signup data received:", req.body);
      
      const validatedData = signUpSchema.parse(req.body);
      
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
        rpName: validatedData.fullName,
        rank: validatedData.rank,
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
      console.error("Signup error:", error);
      if (error.name === 'ZodError') {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({
          message: "Invalid input data",
          errors: error.errors,
          details: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      res.status(500).json({ message: "Failed to create account" });
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

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: req.session.user });
  });

  app.put("/api/auth/profile", requireAuth, async (req, res) => {
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
        const result = await db.update(users)
          .set({
            rpName,
            rank,
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
      
      if (result.mode === 'signup') {
        // Store Discord user info in session for signup
        (req.session as any).discordVerified = result.user;
        res.redirect('/signup?discord=verified');
      } else {
        // For login mode, we would verify the Discord user matches an existing account
        res.redirect('/login?discord=verified');
      }
    } catch (error) {
      console.error("Discord callback error:", error);
      res.status(500).json({ message: "Discord authentication failed" });
    }
  });

  // Citation routes
  app.post("/api/citations", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCitationSchema.parse(req.body);
      
      const citationData = {
        ...validatedData,
        id: nanoid(),
        issuedBy: req.session.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (useFileStorage) {
        await storage.createCitation(citationData);
      } else {
        await db.insert(citations).values(citationData);
      }

      // Send citation to Discord bot
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;
        
        if (discordBotToken && discordChannelId) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          await discordBot.sendCitationReport(citationData);
          console.log("✅ Citation sent to Discord successfully");
        } else {
          console.log("⚠️ Discord bot credentials not configured, citation saved locally only");
        }
      } catch (discordError) {
        console.error("❌ Failed to send citation to Discord:", discordError);
        // Don't fail the entire request if Discord fails
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
        // Remove form-specific fields
        suspectSignature: undefined,
        mugshotBase64: undefined,
        mugshotFile: undefined,
        officerSignatures: undefined,
        timeServed: undefined,
        courtDate: undefined,
        courtLocation: undefined,
        courtPhone: undefined,
        description: undefined
      };

      const validatedData = insertArrestSchema.parse(transformedData);
      
      const arrestData = {
        ...validatedData,
        id: nanoid(),
        arrestedBy: req.session.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (useFileStorage) {
        await storage.saveArrest(arrestData);
      } else {
        await db.insert(arrests).values(arrestData);
      }

      // Send arrest report to Discord bot
      try {
        const discordBotToken = process.env.DISCORD_BOT_TOKEN;
        const discordChannelId = process.env.DISCORD_CHANNEL_ID;
        
        if (discordBotToken && discordChannelId) {
          const discordBot = createDiscordBotService(discordBotToken, discordChannelId);
          // Use original form data for Discord which has more fields
          await discordBot.sendArrestReport(formData);
          console.log("✅ Arrest report sent to Discord successfully");
        } else {
          console.log("⚠️ Discord bot credentials not configured, arrest saved locally only");
        }
      } catch (discordError) {
        console.error("❌ Failed to send arrest report to Discord:", discordError);
        // Don't fail the entire request if Discord fails
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
        userArrests = userArrests.filter(a => a.arrestedBy === req.session.user.id);
      } else {
        userArrests = await db.select().from(arrests).where(eq(arrests.arrestedBy, req.session.user.id)).orderBy(desc(arrests.createdAt));
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

  app.post("/api/admin/block-username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      await storage.blockUsername(username);
      res.json({ message: "Username blocked successfully" });
    } catch (error) {
      console.error("Error blocking username:", error);
      res.status(500).json({ message: "Failed to block username" });
    }
  });

  app.post("/api/admin/unblock-username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      await storage.unblockUsername(username);
      res.json({ message: "Username unblocked successfully" });
    } catch (error) {
      console.error("Error unblocking username:", error);
      res.status(500).json({ message: "Failed to unblock username" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users/:id/admin", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isAdmin } = req.body;
      await storage.updateUserAdmin(userId, isAdmin);
      res.json({ message: "User admin status updated successfully" });
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ message: "Failed to update user admin status" });
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

  app.post("/api/admin/terminate-username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      await storage.terminateUsername(username);
      res.json({ message: "Username terminated successfully" });
    } catch (error) {
      console.error("Error terminating username:", error);
      res.status(500).json({ message: "Failed to terminate username" });
    }
  });

  app.post("/api/admin/unterminate-username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      await storage.unterminateUsername(username);
      res.json({ message: "Username unterminated successfully" });
    } catch (error) {
      console.error("Error unterminating username:", error);
      res.status(500).json({ message: "Failed to unterminate username" });
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