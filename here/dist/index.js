// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  citations;
  currentUserId;
  currentCitationId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.citations = /* @__PURE__ */ new Map();
    this.currentUserId = 1;
    this.currentCitationId = 1;
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.currentUserId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async getCitation(id) {
    return this.citations.get(id);
  }
  async createCitation(insertCitation) {
    const id = this.currentCitationId++;
    const citation = {
      ...insertCitation,
      additionalNotes: insertCitation.additionalNotes || null,
      id,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.citations.set(id, citation);
    return citation;
  }
  async getAllCitations() {
    return Array.from(this.citations.values());
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var citations = pgTable("citations", {
  id: serial("id").primaryKey(),
  officerBadge: text("officer_badge").notNull(),
  officerUsername: text("officer_username").notNull(),
  officerRank: text("officer_rank").notNull(),
  violatorUsername: text("violator_username").notNull(),
  violationType: text("violation_type").notNull(),
  penalCodes: text("penal_codes").array().notNull(),
  amountsDue: decimal("amounts_due", { precision: 10, scale: 2 }).array().notNull(),
  jailTimes: text("jail_times").array().notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  totalJailTime: text("total_jail_time").notNull(),
  additionalNotes: text("additional_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertCitationSchema = createInsertSchema(citations).omit({
  id: true,
  createdAt: true
}).extend({
  penalCodes: z.array(z.string().min(1, "Penal code is required")),
  amountsDue: z.array(z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")),
  jailTimes: z.array(z.string()),
  totalJailTime: z.string()
});

// server/discord.ts
var DiscordWebhookServiceImpl = class {
  webhookUrl;
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }
  async sendCitationReport(data) {
    const citationMessage = `\u{1F3AB} **CITATION ISSUED**

**Ping User Receiving Ticket:** <@${data.violatorUsername}>
**Type of Ticket:** ${data.violationType}
**Penal Code:** ${data.penalCodes.map(
      (code, index) => `${code} - $${data.amountsDue[index]} ${data.jailTimes[index] !== "None" ? `(${data.jailTimes[index]})` : ""}`
    ).join(", ")}
**Total Amount Due:** $${data.totalAmount}
**Additional Notes:** ${data.additionalNotes || "N/A"}

**Department Name:** WSP
**Rank and Signature:** ${data.officerRank} @${data.officerUsername}
**Law Enforcement Name(s):** ${data.officerUsername}
**Badge Number:** ${data.officerBadge}

By signing this citation, you acknowledge that this is NOT an admission of guilt, it is to simply ensure the citation is taken care of. Your court date is shown below, and failure to show will result in a warrant for your arrest. If you have any questions, please contact a Supervisor.

You must pay the citation to @${data.officerUsername}

**Sign at the X:**
X

4000 Capitol Drive, Greenville, Wisconsin 54942

**Court date:** XX/XX/XX
Please contact a Supervisor for further inquiry.`;
    await this.sendWebhook({
      content: citationMessage
    });
  }
  async sendArrestReport(data) {
    const arrestMessage = `\u{1F6A8} **ARREST REPORT**

**Your username:** <@${data.suspectUsername}>
**Law Enforcement username(s):** @${data.officerUsername}
**Ranks:** ${data.officerRank}
**Badge Number:** ${data.officerBadge}

**__Description/Mugshot__**
${data.description || "No description provided"}

\u2014
**__Offense:__**

${data.penalCodes.map((code, index) => {
      const jailTime = data.jailTimes[index];
      const amount = data.amountsDue[index];
      let line = `${code}`;
      if (jailTime && jailTime !== "None") line += ` - ${jailTime}`;
      if (amount && amount !== "0.00") line += ` - $${amount}`;
      return line;
    }).join("\n")}

**Total:** $${data.totalAmount} + ${data.totalJailTime} ${data.timeServed ? "(TIME SERVED)" : ""}

**Sign at the X:**
X

**Arresting officer signature X:**
${data.officerSignature}

4000 Capitol Drive, Greenville, Wisconsin 54942

**Court date:** ${data.courtDate}
Please call ${data.courtPhone} for further inquiry.`;
    await this.sendWebhook({
      content: arrestMessage
    });
  }
  async sendWebhook(payload) {
    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to send Discord webhook:", error);
      throw error;
    }
  }
};
function createDiscordWebhookService(webhookUrl) {
  return new DiscordWebhookServiceImpl(webhookUrl);
}

// server/routes.ts
import { z as z2 } from "zod";
async function registerRoutes(app2) {
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const discordService = discordWebhookUrl ? createDiscordWebhookService(discordWebhookUrl) : null;
  app2.post("/api/citations", async (req, res) => {
    try {
      const validatedData = insertCitationSchema.parse(req.body);
      const citation = await storage.createCitation(validatedData);
      if (discordService) {
        try {
          await discordService.sendCitationReport(validatedData);
        } catch (discordError) {
          console.error("Failed to send citation to Discord:", discordError);
        }
      }
      res.json(citation);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      } else {
        res.status(500).json({
          message: "Internal server error"
        });
      }
    }
  });
  app2.get("/api/citations", async (req, res) => {
    try {
      const citations2 = await storage.getAllCitations();
      res.json(citations2);
    } catch (error) {
      res.status(500).json({
        message: "Internal server error"
      });
    }
  });
  app2.get("/api/citations/:id", async (req, res) => {
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
  app2.post("/api/arrests", async (req, res) => {
    try {
      const arrestData = req.body;
      console.log("Arrest report received:", arrestData);
      if (discordService) {
        try {
          await discordService.sendArrestReport(arrestData);
        } catch (discordError) {
          console.error("Failed to send arrest report to Discord:", discordError);
        }
      }
      res.json({
        message: "Arrest report submitted successfully",
        id: Date.now()
        // temporary ID
      });
    } catch (error) {
      res.status(500).json({
        message: "Internal server error"
      });
    }
  });
  app2.get("/api/arrests", async (req, res) => {
    try {
      res.json([]);
    } catch (error) {
      res.status(500).json({
        message: "Internal server error"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
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
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
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
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
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
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
