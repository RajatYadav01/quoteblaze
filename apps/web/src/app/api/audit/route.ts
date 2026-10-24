import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError } from "@/lib/http";

export async function GET() {
	try {
		const auth = await requireAuth();
		const events = await db
			.select()
			.from(schema.auditEvents)
			.where(eq(schema.auditEvents.companyId, auth.companyId))
			.orderBy(desc(schema.auditEvents.createdAt))
			.limit(200);
		return NextResponse.json({ events });
	} catch (error) {
		return handleRouteError(error);
	}
}
