import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { relations } from "../src/db/relations.ts";
import * as schema from "../src/db/schema.ts";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL tenant isolation integration", () => {
	it("scopes catalogue reads and rejects a cross-tenant customer relationship", async () => {
		const sql = postgres(databaseUrl!, { max: 1 });
		const db = drizzle({ client: sql, relations });
		let companyA: typeof schema.companies.$inferSelect | undefined;
		let companyB: typeof schema.companies.$inferSelect | undefined;

		try {
			const suffix = randomUUID();
			[companyA] = await db
				.insert(schema.companies)
				.values({ name: "Integration Tenant A", slug: `test-a-${suffix}`, settings: {} })
				.returning();
			[companyB] = await db
				.insert(schema.companies)
				.values({ name: "Integration Tenant B", slug: `test-b-${suffix}`, settings: {} })
				.returning();
			await db.insert(schema.rates).values([
				{
					companyId: companyA.id,
					code: "TST-A",
					description: "Tenant A rate",
					unit: "m2",
					rate: "10.00",
					status: "active",
					taxTreatment: "exclusive",
				},
				{
					companyId: companyB.id,
					code: "TST-B",
					description: "Tenant B rate",
					unit: "m2",
					rate: "99.00",
					status: "active",
					taxTreatment: "exclusive",
				},
			]);
			const [customerB] = await db.insert(schema.customers).values({ companyId: companyB.id, name: "Tenant B Customer" }).returning();

			const ratesA = await db.select().from(schema.rates).where(eq(schema.rates.companyId, companyA.id));
			const ratesB = await db.select().from(schema.rates).where(eq(schema.rates.companyId, companyB.id));
			expect(ratesA.map((rate) => rate.code)).toEqual(["TST-A"]);
			expect(ratesB.map((rate) => rate.code)).toEqual(["TST-B"]);

			await expect(
				db.insert(schema.enquiries).values({
					companyId: companyA.id,
					customerId: customerB.id,
					rawText: "A test enquiry with a deliberately invalid cross-tenant customer reference.",
				}),
			).rejects.toThrow();
		} finally {
			if (companyA) await db.delete(schema.companies).where(eq(schema.companies.id, companyA.id));
			if (companyB) await db.delete(schema.companies).where(eq(schema.companies.id, companyB.id));
			await sql.end();
		}
	});
});
