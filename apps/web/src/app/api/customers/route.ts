import { and, desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { handleRouteError, jsonError } from "@/lib/http";
import { writeAudit } from "@/lib/audit";

const customerSchema = z.object({
	name: z.string().trim().min(1).max(200),
	businessName: z.string().max(200).optional(),
	email: z.union([z.string().email().max(320), z.literal("")]).optional(),
	phone: z.string().max(80).optional(),
	address: z.string().max(500).optional(),
	notes: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
	try {
		const auth = await requireAuth();
		const query = new URL(request.url).searchParams.get("q")?.trim();
		const where = query
			? and(
					eq(schema.customers.companyId, auth.companyId),
					or(
						ilike(schema.customers.name, `%${query}%`),
						ilike(schema.customers.businessName, `%${query}%`),
						ilike(schema.customers.email, `%${query}%`),
						ilike(schema.customers.phone, `%${query}%`),
					),
				)
			: eq(schema.customers.companyId, auth.companyId);
		const rows = await db.select().from(schema.customers).where(where).orderBy(desc(schema.customers.updatedAt)).limit(300);
		return NextResponse.json({ customers: rows });
	} catch (error) {
		return handleRouteError(error);
	}
}

export async function POST(request: Request) {
	try {
		const auth = await requireAuth();
		const parsed = customerSchema.safeParse(await request.json());
		if (!parsed.success) return jsonError("Customer details are invalid.", 400, parsed.error.flatten());
		const [customer] = await db
			.insert(schema.customers)
			.values({
				companyId: auth.companyId,
				name: parsed.data.name,
				businessName: parsed.data.businessName || null,
				email: parsed.data.email || null,
				phone: parsed.data.phone || null,
				address: parsed.data.address || null,
				notes: parsed.data.notes || null,
			})
			.returning();
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "customer.created",
			resourceType: "customer",
			resourceId: customer.id,
		});
		return NextResponse.json({ customer }, { status: 201 });
	} catch (error) {
		return handleRouteError(error);
	}
}
