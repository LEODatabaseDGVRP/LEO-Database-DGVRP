import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, citations, arrests, deletedUsernames } from "../shared/schema";

// Create a mock database connection for type safety
// In this project, we use file-based storage but need the table definitions
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://mock",
});

// Export the database instance (even though we use file storage)
export const db = drizzle(pool);

// Export the table definitions for type safety
export { users, citations, arrests, deletedUsernames };

console.log("Database schemas loaded for type safety - using file-based storage");