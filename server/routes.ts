
import { insertUserSchema, signUpSchema, signInSchema, insertCitationSchema, insertArrestSchema, selectUserSchema, selectCitationSchema, selectArrestSchema } from "../shared/schema";
import { users, citations, arrests } from "./db";
import { loadUsers, saveUsers, loadCitations, saveCitations, loadArrests, saveArrests } from "./storage";
import { createDiscordBotService, checkUserRole, sendDiscordMessage, getRandomSystemUsername } from "./discord";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { createServer } from "http";
import express from "express";
import session from "express-session";
import { storage } from "./storage";

const app = express();

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Add express.json() middleware
app.use(express.json());

// Auth middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Auth routes
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const userData = signUpSchema.parse(req.body);
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Create user
    const user = await storage.createUser({
      ...userData,
      password: hashedPassword
    });

    // Create session
    req.session.userId = user.id;
    
    res.json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ message: "Invalid signup data" });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = signInSchema.parse(req.body);
    
    // Find user
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create session
    req.session.userId = user.id;
    
    res.json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ message: "Invalid login data" });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Could not log out" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Citation routes
app.post('/api/citations', requireAuth, async (req: Request, res: Response) => {
  try {
    const citationData = insertCitationSchema.parse(req.body);
    const citation = await storage.createCitation(citationData);
    
    // Send to Discord
    try {
      await sendDiscordMessage(citation, 'citation');
    } catch (discordError) {
      console.error('Discord notification failed:', discordError);
      // Continue even if Discord fails
    }
    
    res.json(citation);
  } catch (error) {
    console.error('Citation creation error:', error);
    res.status(400).json({ message: "Invalid citation data" });
  }
});

app.get('/api/citations', requireAuth, async (req: Request, res: Response) => {
  try {
    const citations = await storage.getAllCitations();
    res.json(citations);
  } catch (error) {
    console.error('Get citations error:', error);
    res.status(500).json({ message: "Failed to fetch citations" });
  }
});

// Arrest routes
app.post('/api/arrests', requireAuth, async (req: Request, res: Response) => {
  try {
    const arrestData = insertArrestSchema.parse(req.body);
    const arrest = await storage.createArrest(arrestData);
    
    // Send to Discord
    try {
      await sendDiscordMessage(arrest, 'arrest');
    } catch (discordError) {
      console.error('Discord notification failed:', discordError);
      // Continue even if Discord fails
    }
    
    res.json(arrest);
  } catch (error) {
    console.error('Arrest creation error:', error);
    res.status(400).json({ message: "Invalid arrest data" });
  }
});

app.get('/api/arrests', requireAuth, async (req: Request, res: Response) => {
  try {
    const arrests = await storage.getAllArrests();
    res.json(arrests);
  } catch (error) {
    console.error('Get arrests error:', error);
    res.status(500).json({ message: "Failed to fetch arrests" });
  }
});

// Admin routes
app.get('/api/admin/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const citations = await storage.getAllCitations();
    const arrests = await storage.getAllArrests();
    
    res.json({
      totalCitations: citations.length,
      totalArrests: arrests.length,
      recentActivity: [...citations, ...arrests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

const server = createServer(app);

export default function registerRoutes(app: express.Express) {
  return server;
}
