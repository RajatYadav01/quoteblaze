import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is required");
	process.exit(1);
}
const migrationClient = postgres(url, { max: 1 });
const db = drizzle({ client: migrationClient });

async function main() {
	console.log("Running database migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("Database migrations completed.");
	await migrationClient.end();
}
main().catch((err) => {
	console.error(err);
	process.exit(1);
});
