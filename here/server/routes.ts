import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertCitationSchema, insertUserSchema } from "@shared/schema";
import { createDiscordBotService } from "./discord";
import { createDiscordOAuthService } from "./discord-oauth";
import { z } from "zod";

// Session middleware
function setupSession(app: Express) {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'law-enforcement-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
}

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Admin middleware
async function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user || user.isAdmin !== "true") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Failed to verify admin status" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupSession(app);
  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists (case-insensitive)
      const allUsers = await storage.getAllUsers();
      const existingUser = allUsers.find(user => 
        user.username.toLowerCase() === validatedData.username.toLowerCase()
      );
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if username is blocked
      const isBlocked = await storage.isUsernameBlocked(validatedData.username);
      if (isBlocked) {
        return res.status(400).json({ message: "Username is not available" });
      }

      // Check if username is terminated
      const isTerminated = await storage.isUsernameTerminated(validatedData.username);
      if (isTerminated) {
        return res.status(400).json({ message: "Username is terminated and cannot be used" });
      }

      // Check for Discord OAuth verification
      const discordVerification = (req.session as any)?.discordVerified;
      if (!discordVerification) {
        return res.status(400).json({ 
          message: "Discord verification required. Please complete Discord authentication first." 
        });
      }

      // Use Discord ID from OAuth verification
      validatedData.discordId = discordVerification.id;

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        username: validatedData.username,
        password: hashedPassword,
        badgeNumber: validatedData.badgeNumber,
        rpName: validatedData.rpName,
        rank: validatedData.rank,
        discordId: validatedData.discordId,
      });

      // Auto-login the user after account creation
      (req.session as any).userId = user.id;

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json({ 
        success: true, 
        user: userWithoutPassword,
        message: "Account created successfully" 
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input data" });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Check if username is terminated
      const isTerminated = await storage.isUsernameTerminated(username);
      if (isTerminated) {
        return res.status(403).json({ message: "This account has been terminated and cannot be used for login" });
      }

      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Create session
      (req.session as any).userId = user.id;
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({ 
        success: true, 
        user: userWithoutPassword,
        message: "Login successful" 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Authentication check failed" });
    }
  });

  // Discord OAuth routes
  app.get("/api/auth/discord/url", (req, res) => {
    if (!discordOAuthService) {
      return res.status(500).json({ message: "Discord OAuth not configured" });
    }

    try {
      const state = Math.random().toString(36).substring(2, 15);
      (req.session as any).discordState = state;
      
      const authUrl = discordOAuthService.getAuthUrl(state);
      res.json({ url: authUrl, state });
    } catch (error) {
      console.error("Discord OAuth URL error:", error);
      res.status(500).json({ message: "Failed to generate Discord OAuth URL" });
    }
  });

  // Direct Discord login route
  app.get("/api/auth/discord", (req, res) => {
    if (!discordOAuthService) {
      return res.status(500).json({ message: "Discord OAuth not configured" });
    }

    try {
      const state = Math.random().toString(36).substring(2, 15);
      (req.session as any).discordState = state;
      
      const authUrl = discordOAuthService.getAuthUrl(state);
      res.redirect(authUrl);
    } catch (error) {
      console.error("Discord OAuth redirect error:", error);
      res.status(500).json({ message: "Failed to start Discord authentication" });
    }
  });

  // Check Discord verification status
  app.get("/api/auth/discord/status", (req, res) => {
    const discordVerified = (req.session as any)?.discordVerified;
    
    if (discordVerified) {
      res.json({
        verified: true,
        user: {
          id: discordVerified.id,
          username: discordVerified.username,
          discriminator: '0000'
        }
      });
    } else {
      res.json({ verified: false });
    }
  });

  // Disconnect Discord verification
  app.post("/api/auth/discord/disconnect", (req, res) => {
    delete (req.session as any)?.discordVerified;
    res.json({ success: true, message: "Discord disconnected successfully" });
  });

  // GET handler for Discord OAuth callback (when Discord redirects back)
  app.get("/api/auth/discord/callback", async (req, res) => {
    if (!discordOAuthService) {
      return res.status(500).send("Discord OAuth not configured");
    }

    try {
      const { code, state } = req.query;
      
      // Verify state to prevent CSRF
      if (state !== (req.session as any)?.discordState) {
        return res.status(400).send("Invalid state parameter");
      }

      // Exchange code for access token and user info
      const { accessToken, user } = await discordOAuthService.exchangeCode(code as string);
      
      // Check if user is in required guild with required role
      const guildId = process.env.DISCORD_GUILD_ID;
      const requiredRole = process.env.DISCORD_REQUIRED_ROLE;
      
      if (guildId) {
        const hasAccess = await discordOAuthService.checkUserRole(accessToken, guildId, requiredRole);
        if (!hasAccess) {
          return res.status(403).send(requiredRole 
            ? `Access denied. You must be in the Discord server with the "${requiredRole}" role.`
            : "Access denied. You must be in the Discord server.");
        }
      }

      // Check if this Discord user already exists in our database
      const allUsers = await storage.getAllUsers();
      const existingUser = allUsers.find(u => u.discordId === user.id);
      
      if (existingUser) {
        // User exists, log them in directly
        (req.session as any).userId = existingUser.id;
        
        // Clean up state
        delete (req.session as any).discordState;
        
        // Redirect to main page
        return res.redirect("/");
      } else {
        // Store Discord verification for signup
        (req.session as any).discordVerified = {
          id: user.id,
          username: user.username,
          accessToken: accessToken,
          verifiedAt: new Date().toISOString()
        };

        // Clean up state
        delete (req.session as any).discordState;

        // Redirect to signup page
        return res.redirect("/signup");
      }
    } catch (error) {
      console.error("Discord OAuth callback error:", error);
      return res.status(500).send("Discord verification failed");
    }
  });

  app.post("/api/auth/discord/callback", async (req, res) => {
    if (!discordOAuthService) {
      return res.status(500).json({ message: "Discord OAuth not configured" });
    }

    try {
      const { code, state } = req.body;
      
      // Verify state to prevent CSRF
      if (state !== (req.session as any)?.discordState) {
        return res.status(400).json({ message: "Invalid state parameter" });
      }

      // Exchange code for access token and user info
      const { accessToken, user } = await discordOAuthService.exchangeCode(code);
      
      // Check if user is in required guild with required role
      const guildId = process.env.DISCORD_GUILD_ID;
      const requiredRole = process.env.DISCORD_REQUIRED_ROLE;
      
      if (guildId) {
        const hasAccess = await discordOAuthService.checkUserRole(accessToken, guildId, requiredRole);
        if (!hasAccess) {
          return res.status(403).json({ 
            message: requiredRole 
              ? `Access denied. You must be in the Discord server with the "${requiredRole}" role.`
              : "Access denied. You must be in the Discord server."
          });
        }
      }

      // Store Discord verification in session
      (req.session as any).discordVerified = {
        id: user.id,
        username: user.username,
        accessToken: accessToken,
        verifiedAt: new Date().toISOString()
      };

      // Clean up state
      delete (req.session as any).discordState;

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator
        },
        message: "Discord verification successful" 
      });
    } catch (error) {
      console.error("Discord OAuth callback error:", error);
      res.status(500).json({ message: "Discord verification failed" });
    }
  });

  // User profile update route
  app.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const { rpName, rank, discordId, badgeNumber } = req.body;

      const updatedUser = await storage.updateUserProfile(userId, {
        rpName,
        rank,
        discordId,
        badgeNumber
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ 
        success: true, 
        user: userWithoutPassword, 
        message: "Profile updated successfully" 
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Initialize Discord bot service
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordService = (discordBotToken && discordChannelId) ? createDiscordBotService(discordBotToken, discordChannelId) : null;

  // Initialize Discord OAuth service
  const currentDomain = process.env.RENDER_EXTERNAL_URL 
    ? new URL(process.env.RENDER_EXTERNAL_URL).host 
    : process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  const redirectUri = `https://${currentDomain}/api/auth/discord/callback`;
  console.log('Using Discord redirect URI:', redirectUri);
  
  const discordOAuthService = (
    process.env.DISCORD_CLIENT_ID && 
    process.env.DISCORD_CLIENT_SECRET && 
    discordBotToken
  ) ? createDiscordOAuthService(
    process.env.DISCORD_CLIENT_ID,
    process.env.DISCORD_CLIENT_SECRET,
    redirectUri,
    discordBotToken,
    process.env.DISCORD_GUILD_ID
  ) : null;
  
  // Initialize Discord bot if configured
  if (discordService) {
    try {
      await discordService.initialize();
      console.log('Discord bot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error);
    }
  }

  // Create citation (protected route)
  app.post("/api/citations", requireAuth, async (req, res) => {
    try {
      console.log("=== CITATION SUBMISSION START ===");
      console.log("Request method:", req.method);
      console.log("Request URL:", req.url);
      console.log("Content-Type:", req.headers['content-type']);
      console.log("Request body type:", typeof req.body);
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      // Validate the incoming data
      const validatedData = insertCitationSchema.parse(req.body);
      console.log("✅ Schema validation successful");
      console.log("✅ Validated data:", JSON.stringify(validatedData, null, 2));
      
      // Create citation in storage
      const citation = await storage.createCitation(validatedData);
      console.log("✅ Citation created successfully with ID:", citation.id);
      
      // Send to Discord if service is configured
      if (discordService) {
        try {
          console.log("📨 Attempting to send citation to Discord...");
          console.log("📊 Data being sent to Discord service:", JSON.stringify(validatedData, null, 2));
          
          await discordService.sendCitationReport(validatedData);
          console.log("✅ Citation sent to Discord successfully");
        } catch (discordError) {
          console.error('❌ Failed to send citation to Discord:', discordError);
          console.error('Discord error stack:', discordError instanceof Error ? discordError.stack : 'No stack trace');
          // Don't fail the request if Discord fails
        }
      } else {
        console.log("⚠️ Discord service not configured, skipping Discord notification");
      }
      
      console.log("=== CITATION SUBMISSION COMPLETE ===");
      
      // Send success response
      const responseData = { 
        success: true,
        citation,
        message: "Citation submitted successfully" 
      };
      
      console.log("📤 Sending response:", responseData);
      res.status(200).json(responseData);
      
    } catch (error) {
      console.error("❌ Citation submission error:", error);
      console.error("❌ Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      
      if (error instanceof z.ZodError) {
        console.log("❌ Validation errors:", error.errors);
        const errorResponse = { 
          success: false,
          message: "Validation failed", 
          errors: error.errors 
        };
        console.log("📤 Sending validation error response:", errorResponse);
        res.status(400).json(errorResponse);
      } else {
        console.error("❌ Unexpected error:", error);
        const errorResponse = { 
          success: false,
          message: "Internal server error",
          error: error instanceof Error ? error.message : "Unknown error"
        };
        console.log("📤 Sending server error response:", errorResponse);
        res.status(500).json(errorResponse);
      }
    }
  });

  // Get all citations (protected route)
  app.get("/api/citations", requireAuth, async (req, res) => {
    try {
      const citations = await storage.getAllCitations();
      res.json(citations);
    } catch (error) {
      res.status(500).json({ 
        message: "Internal server error" 
      });
    }
  });

  // Get citation by ID (protected route)
  app.get("/api/citations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid citation ID" });
      }
      
      const citation = await storage.getCitation(id);
      if (!citation) {
        return res.status(404).json({ message: "Citation not found" });
      }
      
      res.json(citation);
    } catch (error) {
      res.status(500).json({ 
        message: "Internal server error" 
      });
    }
  });

  // Create arrest report (protected route)
  app.post("/api/arrests", requireAuth, async (req, res) => {
    try {
      const arrestData = req.body;
      console.log("Arrest report received:", arrestData);
      
      // Send to Discord if webhook is configured
      if (discordService) {
        try {
          await discordService.sendArrestReport(arrestData);
        } catch (discordError) {
          console.error('Failed to send arrest report to Discord:', discordError);
          // Don't fail the request if Discord fails
        }
      }
      
      res.json({ 
        message: "Arrest report submitted successfully",
        id: Date.now() // temporary ID
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Internal server error" 
      });
    }
  });

  // Get all arrest reports (protected route)
  app.get("/api/arrests", requireAuth, async (req, res) => {
    try {
      // Placeholder - you can implement storage later
      res.json([]);
    } catch (error) {
      res.status(500).json({ 
        message: "Internal server error" 
      });
    }
  });

  // Temporary admin setup route (remove after use)
  app.post("/api/setup-admin", async (req, res) => {
    try {
      // Make the first user (ID 1) an admin
      await storage.updateUserAdmin(1, true);
      
      // Also make Popfork1 and Fork admins if they exist
      const allUsers = await storage.getAllUsers();
      for (const user of allUsers) {
        if (user.username.toLowerCase() === "popfork1" || user.username.toLowerCase() === "fork") {
          await storage.updateUserAdmin(user.id, true);
        }
      }
      
      res.json({ message: "Admin setup complete" });
    } catch (error) {
      console.error("Admin setup error:", error);
      res.status(500).json({ message: "Failed to setup admin" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Don't allow deleting yourself
      if (userId === req.session.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Get the user to check if it's popfork1
      const targetUser = await storage.getUser(userId);
      if (targetUser && targetUser.username.toLowerCase() === "popfork1") {
        return res.status(403).json({ message: "Cannot delete the popfork1 account" });
      }

      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.put("/api/admin/users/:id/admin", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isAdmin } = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Don't allow modifying yourself
      if (userId === req.session.userId) {
        return res.status(400).json({ message: "Cannot modify your own admin status" });
      }

      // Get the user to check if it's popfork1
      const targetUser = await storage.getUser(userId);
      if (targetUser && targetUser.username.toLowerCase() === "popfork1") {
        return res.status(403).json({ message: "Cannot modify popfork1's admin status" });
      }

      await storage.updateUserAdmin(userId, isAdmin);
      res.json({ message: "User admin status updated successfully" });
    } catch (error) {
      console.error("Update user admin error:", error);
      res.status(500).json({ message: "Failed to update user admin status" });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const citationCount = await storage.getCitationCount();
      const arrestCount = await storage.getArrestCount();
      
      res.json({
        citations: citationCount,
        arrests: arrestCount
      });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get("/api/admin/blocked-usernames", requireAdmin, async (req, res) => {
    try {
      const blockedUsernames = await storage.getBlockedUsernames();
      res.json(blockedUsernames);
    } catch (error) {
      console.error("Get blocked usernames error:", error);
      res.status(500).json({ message: "Failed to fetch blocked usernames" });
    }
  });

  app.post("/api/admin/blocked-usernames", requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      // Don't allow blocking popfork1
      if (username.toLowerCase() === "popfork1") {
        return res.status(403).json({ message: "Cannot block the popfork1 username" });
      }
      
      await storage.blockUsername(username);
      res.json({ message: "Username blocked successfully" });
    } catch (error) {
      console.error("Block username error:", error);
      res.status(500).json({ message: "Failed to block username" });
    }
  });

  app.delete("/api/admin/blocked-usernames/:username", requireAdmin, async (req, res) => {
    try {
      const username = req.params.username;
      await storage.unblockUsername(username);
      res.json({ message: "Username unblocked successfully" });
    } catch (error) {
      console.error("Unblock username error:", error);
      res.status(500).json({ message: "Failed to unblock username" });
    }
  });

  app.get("/api/admin/terminated-usernames", requireAdmin, async (req, res) => {
    try {
      const terminatedUsernames = await storage.getTerminatedUsernames();
      res.json(terminatedUsernames);
    } catch (error) {
      console.error("Get terminated usernames error:", error);
      res.status(500).json({ message: "Failed to fetch terminated usernames" });
    }
  });

  app.post("/api/admin/terminated-usernames", requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      // Don't allow terminating popfork1
      if (username.toLowerCase() === "popfork1") {
        return res.status(403).json({ message: "Cannot terminate the popfork1 username" });
      }
      
      await storage.terminateUsername(username);
      res.json({ message: "Username terminated successfully" });
    } catch (error) {
      console.error("Terminate username error:", error);
      res.status(500).json({ message: "Failed to terminate username" });
    }
  });

  app.delete("/api/admin/terminated-usernames/:username", requireAdmin, async (req, res) => {
    try {
      const username = req.params.username;
      await storage.unterminateUsername(username);
      res.json({ message: "Username unterminated successfully" });
    } catch (error) {
      console.error("Unterminate username error:", error);
      res.status(500).json({ message: "Failed to unterminate username" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
