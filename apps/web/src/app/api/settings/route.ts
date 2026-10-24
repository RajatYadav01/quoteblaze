import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { handleRouteError, jsonError } from "@/lib/http";
import { writeAudit } from "@/lib/audit";

const settingsSchema = z.object({
	vatRate: z.number().min(0).max(1),
	minimumCharge: z.number().nonnegative().max(1_000_000),
	quoteValidityDays: z.number().int().min(1).max(365),
	siteVisitThresholdM2: z.number().positive().max(100_000),
});

export async function GET() {
	try {
		const auth = await requireAuth();
		const company = (await db.select().from(schema.companies).where(eq(schema.companies.id, auth.companyId)).limit(1))[0];
		const credential = (
			await db
				.select({ model: schema.companyAiCredentials.model, lastTestedAt: schema.companyAiCredentials.lastTestedAt })
				.from(schema.companyAiCredentials)
				.where(eq(schema.companyAiCredentials.companyId, auth.companyId))
				.limit(1)
		)[0];
		if (!company) return jsonError("Company not found.", 404);
		return NextResponse.json({
			settings: {
				name: company.name,
				currency: company.currency,
				vatRate: Number(company.vatRate),
				minimumCharge: Number(company.minimumCharge),
				quoteValidityDays: company.quoteValidityDays,
				siteVisitThresholdM2: company.settings?.siteVisitThresholdM2 ?? 500,
			},
			ai: {
				configured: Boolean(credential),
				model: credential?.model ?? "openrouter/free",
				lastTestedAt: credential?.lastTestedAt ?? null,
			},
		});
	} catch (error) {
		return handleRouteError(error);
	}
}

export async function PATCH(request: Request) {
	try {
		const auth = await requireAuth();
		if (!["owner", "admin"].includes(auth.role)) return jsonError("Only company administrators can update settings.", 403);
		const parsed = settingsSchema.safeParse(await request.json());
		if (!parsed.success) return jsonError("Company settings are invalid.", 400, parsed.error.flatten());
		const company = (
			await db
				.select({ settings: schema.companies.settings })
				.from(schema.companies)
				.where(eq(schema.companies.id, auth.companyId))
				.limit(1)
		)[0];
		const existing = company?.settings ?? {};
		const updatedSettings = { ...existing, siteVisitThresholdM2: parsed.data.siteVisitThresholdM2 };
		const [updated] = await db
			.update(schema.companies)
			.set({
				vatRate: parsed.data.vatRate.toFixed(6),
				minimumCharge: parsed.data.minimumCharge.toFixed(2),
				quoteValidityDays: parsed.data.quoteValidityDays,
				settings: updatedSettings,
				updatedAt: new Date(),
			})
			.where(eq(schema.companies.id, auth.companyId))
			.returning();
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "company.settings_updated",
			resourceType: "company",
			resourceId: auth.companyId,
			metadata: { fields: Object.keys(parsed.data) },
		});
		return NextResponse.json({
			settings: {
				vatRate: Number(updated.vatRate),
				minimumCharge: Number(updated.minimumCharge),
				quoteValidityDays: updated.quoteValidityDays,
				siteVisitThresholdM2: updated.settings?.siteVisitThresholdM2,
			},
		});
	} catch (error) {
		return handleRouteError(error);
	}
}
