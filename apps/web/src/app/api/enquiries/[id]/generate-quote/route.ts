import { NextResponse } from "next/server";
import { generateQuoteFromEnquiry } from "@/features/quoting/service";
import { requireAuth } from "@/lib/auth/session";
import { handleRouteError, jsonError } from "@/lib/http";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const auth = await requireAuth();
		const { id } = await params;
		const result = await generateQuoteFromEnquiry(auth.companyId, auth.userId, id);
		return NextResponse.json(
			{
				quote: result.quote,
				revision: result.revision,
				blockers: result.blockers,
				totals: result.totals,
				lineItems: result.lineItems,
			},
			{ status: 201 },
		);
	} catch (error) {
		if (
			error instanceof Error &&
			["Enquiry not found.", "Analyse the enquiry before generating a quote.", "Company configuration not found."].includes(
				error.message,
			)
		)
			return jsonError(error.message, 422);
		return handleRouteError(error);
	}
}
