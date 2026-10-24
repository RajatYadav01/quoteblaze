import { asc, and, eq, ilike, or, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/http";

export async function GET(request: Request) {
	try {
		const auth = await requireAuth();
		const query = new URL(request.url).searchParams.get("q")?.trim();
		const status = new URL(request.url).searchParams.get("status");
		const filters: SQL[] = [eq(schema.rates.companyId, auth.companyId)];
		if (query) filters.push(or(ilike(schema.rates.code, `%${query}%`), ilike(schema.rates.description, `%${query}%`))!);
		if (status && ["active", "needs_review", "inactive"].includes(status)) filters.push(eq(schema.rates.status, status));
		const rows = await db
			.select()
			.from(schema.rates)
			.where(and(...filters))
			.orderBy(asc(schema.rates.code))
			.limit(500);
		return NextResponse.json({ rates: rows });
	} catch (error) {
		return handleRouteError(error);
	}
}
