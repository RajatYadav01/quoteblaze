import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { companies, customers, memberships, rates, users } from "./db/schema.ts";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
	throw new Error(
		"Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true only for an explicitly approved, isolated demo database.",
	);
}
const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle({ client: sql });
const seedData = fileURLToPath(new URL("../../../seed-data/", import.meta.url));
const seedPath = resolve(seedData);

function readCsv<T extends Record<string, string>>(content: string): T[] {
	return parse(content, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: false }) as T[];
}

function parseAmount(value: string): number | null {
	const cleaned = value.replace(/[£,\s]/g, "");
	if (!cleaned || /tbc|check|unknown/i.test(cleaned) || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
	const n = Number(cleaned);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeUnit(value: string): string {
	const normalized = value.trim().toLowerCase().replace("m²", "m2").replace("sqm", "m2").replace("lin m", "lm").replace("linear m", "lm");
	return normalized || "unknown";
}

function rateStatus(row: Record<string, string>, parsedRate: number | null): string {
	const code = row.Code.toUpperCase();
	const text = `${row.Notes ?? ""} ${row.Item ?? ""}`.toLowerCase();
	if (code === "KB04" || code === "TM03" || code === "MI01" || parsedRate === null) return "inactive";
	if (["SB02", "SB03", "BP02", "BP04", "EX06", "CO02", "PT01", "MI02"].includes(code)) return "needs_review";
	if (/old|usually included|same as|check|think|inc vat|subject to|ask dave/.test(text)) return "needs_review";
	return "active";
}

async function seedRates(companyId: string, relativeCsvPath: string, syncExistingRates = false) {
	const rawRates = readCsv<Record<string, string>>(await readFile(resolve(seedPath, relativeCsvPath), "utf8"));
	for (const row of rawRates) {
		const code = row.Code?.trim().toUpperCase();
		const description = row.Item?.trim();
		const sourceUnit = row.Unit?.trim();
		if (!code || !description || !sourceUnit) {
			throw new Error(`Invalid rate row in ${relativeCsvPath}: Code, Item, and Unit are required.`);
		}
		const unit = normalizeUnit(sourceUnit);

		const rate = parseAmount(row.Rate ?? "");
		const status = rateStatus({ ...row, Code: code, Item: description }, rate);
		const taxTreatment = code === "PT01" ? "inclusive" : status === "needs_review" ? "unknown" : "exclusive";
		const reviewNotes =
			code === "MI01"
				? "Handled by the company minimum-charge rule; do not add as a quote line."
				: status === "needs_review" || status === "inactive"
					? "Imported from seed CSV; verify before use."
					: null;
		const values = {
			companyId,
			code,
			description,
			unit,
			rate: rate === null ? null : rate.toFixed(2),
			status,
			taxTreatment,
			sourceNotes: row.Notes?.trim() || null,
			reviewNotes,
			sourceRow: row,
		};

		if (syncExistingRates) {
			await db
				.insert(rates)
				.values(values)
				.onConflictDoUpdate({
					target: [rates.companyId, rates.code],
					set: {
						description: values.description,
						unit: values.unit,
						rate: values.rate,
						status: values.status,
						taxTreatment: values.taxTreatment,
						sourceNotes: values.sourceNotes,
						reviewNotes: values.reviewNotes,
						sourceRow: values.sourceRow,
					},
				});
		} else {
			await db
				.insert(rates)
				.values(values)
				.onConflictDoNothing({ target: [rates.companyId, rates.code] });
		}
	}
}

async function seedCustomers(companyId: string, relativeCsvPath: string, duplicateGroups: Record<number, string> = {}) {
	const rawCustomers = readCsv<Record<string, string>>(await readFile(resolve(seedPath, relativeCsvPath), "utf8"));
	for (const [index, row] of rawCustomers.entries()) {
		const name = row.Name?.trim();
		if (!name) throw new Error(`Invalid customer row in ${relativeCsvPath} at line ${index + 2}: Name is required.`);

		const sourceNotes = row.Notes?.trim() || "";
		const duplicateGroup = /duplicate/i.test(sourceNotes) ? `source-duplicate-${index}` : (duplicateGroups[index] ?? null);
		const email = row.Email?.trim() || null;
		const filters = [
			eq(customers.companyId, companyId),
			eq(customers.name, name),
			email ? eq(customers.email, email) : isNull(customers.email),
		];
		const existing = (
			await db
				.select({ id: customers.id })
				.from(customers)
				.where(and(...filters))
				.limit(1)
		)[0];
		const values = {
			companyId,
			name,
			businessName: row.Company?.trim() || null,
			email,
			phone: row.Phone?.trim() || null,
			address: row.Address?.trim() || null,
			notes: sourceNotes || null,
			duplicateGroup,
			sourceRow: row,
		};

		// Preserve ambiguous source records and update the matching seeded record on rerun.
		if (existing) await db.update(customers).set(values).where(eq(customers.id, existing.id));
		else await db.insert(customers).values(values);
	}
}

async function main() {
	const [hollis] = await db
		.insert(companies)
		.values({
			name: "Hollis Groundworks",
			slug: "hollis-groundworks",
			currency: "GBP",
			vatRate: "0.2",
			minimumCharge: "450.00",
			settings: { quoteFormat: "ex_vat", siteVisitThresholdM2: 500 },
		})
		.onConflictDoUpdate({ target: companies.slug, set: { name: "Hollis Groundworks" } })
		.returning();
	const [greenfield] = await db
		.insert(companies)
		.values({
			name: "Greenfield Landscapes",
			slug: "greenfield-landscapes",
			currency: "GBP",
			vatRate: "0.2",
			minimumCharge: "350.00",
			settings: { quoteFormat: "ex_vat", siteVisitThresholdM2: 300 },
		})
		.onConflictDoUpdate({ target: companies.slug, set: { name: "Greenfield Landscapes" } })
		.returning();

	const accounts = [
		{ email: "dave@hollisgroundworks.example", fullName: "Dave Hollis", password: "HollisDemo!2026", companyId: hollis.id },
		{ email: "gaz@greenfieldlandscapes.example", fullName: "Gaz Miller", password: "GreenfieldDemo!2026", companyId: greenfield.id },
	];
	for (const account of accounts) {
		const hash = await bcrypt.hash(account.password, 12);
		const [user] = await db
			.insert(users)
			.values({ email: account.email, fullName: account.fullName, passwordHash: hash })
			.onConflictDoUpdate({ target: users.email, set: { fullName: account.fullName, passwordHash: hash, isActive: true } })
			.returning();
		await db
			.insert(memberships)
			.values({ companyId: account.companyId, userId: user.id, role: "owner", canApprove: true })
			.onConflictDoUpdate({ target: [memberships.companyId, memberships.userId], set: { role: "owner", canApprove: true } });
	}

	const hollisDuplicateGroups: Record<number, string> = {
		0: "okafor-address",
		1: "okafor-address",
		2: "kestrel-row-contacts",
		3: "kestrel-row-contacts",
		5: "sandhu-records",
		6: "sandhu-records",
		9: "doyle-records",
		10: "doyle-records",
	};
	await seedRates(hollis.id, "hollis/rates.csv");
	await seedCustomers(hollis.id, "hollis/customers.csv", hollisDuplicateGroups);

	await seedRates(greenfield.id, "greenfield/rates.csv", true);
	await seedCustomers(greenfield.id, "greenfield/customers.csv");

	console.log("Seeding of demo data has been completed.");
}

try {
	await main();
} finally {
	await sql.end();
}
