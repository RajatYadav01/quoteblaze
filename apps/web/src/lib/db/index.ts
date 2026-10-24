import "server-only";
import { relations } from "@quoteblaze/database/relations";
import * as schema from "@quoteblaze/database/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV !== "test") {
	throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.");
}

const globalForDb = globalThis as unknown as { quoteblazeSql?: ReturnType<typeof postgres> };
const client =
	globalForDb.quoteblazeSql ?? (connectionString ? postgres(connectionString, { max: 10, idle_timeout: 20, connect_timeout: 10 }) : null);
if (process.env.NODE_ENV !== "production" && client) globalForDb.quoteblazeSql = client;

export const db = client ? drizzle({ client, relations }) : (null as never);
export { schema };
