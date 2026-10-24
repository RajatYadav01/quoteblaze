import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/http";
import { listQuotes } from "@/features/quoting/service";

export async function GET() {
	try {
		const auth = await requireAuth();
		return NextResponse.json({ quotes: await listQuotes(auth.companyId) });
	} catch (error) {
		return handleRouteError(error);
	}
}
