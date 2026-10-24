import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://quoteblaze:172115205@localhost:5432/quoteblaze" },
});
