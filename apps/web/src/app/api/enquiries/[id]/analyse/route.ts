import { quoteabilityFor } from "@quoteblaze/pricing-engine";
import type { JobAnalysis } from "@quoteblaze/types";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AiConfigurationError, analyseEnquiry } from "@/features/ai-analysis/service";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const auth = await requireAuth();
		const { id } = await params;
		const enquiry = (
			await db
				.select()
				.from(schema.enquiries)
				.where(and(eq(schema.enquiries.id, id), eq(schema.enquiries.companyId, auth.companyId)))
				.limit(1)
		)[0];
		if (!enquiry) return jsonError("Enquiry not found.", 404);
		const { analysis, model } = await analyseEnquiry(auth.companyId, enquiry.rawText);
		const company = (
			await db
				.select({ settings: schema.companies.settings })
				.from(schema.companies)
				.where(eq(schema.companies.id, auth.companyId))
				.limit(1)
		)[0];
		const thresholdValue = company?.settings?.siteVisitThresholdM2;
		const threshold = typeof thresholdValue === "number" ? thresholdValue : 500;
		const quoteability = quoteabilityFor(analysis as JobAnalysis, threshold);
		const [updated] = await db
			.update(schema.enquiries)
			.set({ analysis, quoteability: quoteability.status, analysisError: null, updatedAt: new Date() })
			.where(and(eq(schema.enquiries.id, id), eq(schema.enquiries.companyId, auth.companyId)))
			.returning();
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "enquiry.analysed",
			resourceType: "enquiry",
			resourceId: id,
			metadata: { model, quoteability: quoteability.status },
		});
		return NextResponse.json({ enquiry: updated, analysis, quoteability, model });
	} catch (error) {
		if (error instanceof AiConfigurationError) return jsonError(error.message, 422);
		return handleRouteError(error);
	}
}
