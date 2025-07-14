import { insertUserSchema, signUpSchema, signInSchema, insertCitationSchema, insertArrestSchema, selectUserSchema, selectCitationSchema, selectArrestSchema } from "../shared/schema";
import { users, citations, arrests } from "./db";
import { loadUsers, saveUsers, loadCitations, saveCitations, loadArrests, saveArrests } from "./storage";
import { createDiscordBotService, checkUserRole, sendDiscordMessage } from "./discord";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getRandomSystemUsername } from "./discord";
```