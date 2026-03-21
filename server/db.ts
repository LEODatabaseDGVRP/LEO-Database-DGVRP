import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, citations, arrests, deletedUsernames, terminatedUsernames } from "../shared/schema";

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL!;

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);

export { users, citations, arrests, deletedUsernames, terminatedUsernames };
