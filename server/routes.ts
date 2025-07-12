import type { Express } from "express";
import { db } from "./db";
import { insertUserSchema, selectUserSchema, insertCitationSchema, selectCitationSchema, insertArrestSchema, selectArrestSchema, signUpSchema, loginSchema, type SelectUser, type InsertUser, type SelectCitation, type InsertCitation, type SelectArrest, type InsertArrest } from "../shared/schema";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { users, citations, arrests } from "./db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { getRandomSystemUsername } from "./discord";
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

      const isValid = await bcrypt.compare(validatedData.password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      req.session.user = {
        id: user.id,
        username: user.username,
        badgeNumber: user.badgeNumber,
        fullName: user.fullName,
        department: user.department,
        rank: user.rank,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
        avatarUrl: user.avatarUrl,
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
        id: userData.id,
        username: userData.username,
        badgeNumber: userData.badgeNumber,
        fullName: userData.fullName,
        department: userData.department,
        rank: userData.rank,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        isAdmin: userData.isAdmin,
        avatarUrl: userData.avatarUrl,
        discordId: userData.discordId
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

  // Discord OAuth routes
  app.get("/api/auth/discord", (req, res) => {
    const { mode } = req.query;
    const discordAuthUrl = getDiscordAuthUrl(mode as string);
    res.json({ url: discordAuthUrl });
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
        await fileStorage.saveCitation(citationData);
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
        const allCitations = await fileStorage.getCitations();
        userCitations = allCitations.filter(c => c.issuedBy === req.session.user.id);
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
      const validatedData = insertArrestSchema.parse(req.body);
      
      const arrestData = {
        ...validatedData,
        id: nanoid(),
        arrestedBy: req.session.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (useFileStorage) {
        await fileStorage.saveArrest(arrestData);
      } else {
        await db.insert(arrests).values(arrestData);
      }

      res.json({ 
        message: "Arrest record created successfully",
        arrest: arrestData
      });
    } catch (error) {
      console.error("Arrest creation error:", error);
      res.status(500).json({ message: "Failed to create arrest record" });
    }
  });

  app.get("/api/arrests", requireAuth, async (req, res) => {
    try {
      let userArrests;
      if (useFileStorage) {
        const allArrests = await fileStorage.getArrests();
        userArrests = allArrests.filter(a => a.arrestedBy === req.session.user.id);
      } else {
        userArrests = await db.select().from(arrests).where(eq(arrests.arrestedBy, req.session.user.id)).orderBy(desc(arrests.createdAt));
      }

      res.json({ arrests: userArrests });
    } catch (error) {
      console.error("Error fetching arrests:", error);
      res.status(500).json({ message: "Failed to fetch arrests" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}