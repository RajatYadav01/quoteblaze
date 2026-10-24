import { buildPricingLines, calculateTotals, roundMoney } from "@quoteblaze/pricing-engine";
import { updateQuoteSchema } from "@quoteblaze/schemas";
import type { JobAnalysis } from "@quoteblaze/types";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getQuote } from "@/features/quoting/service";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";

const { quotes, quoteRevisions, rates, companies, enquiries } = schema;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const auth = await requireAuth();
		const { id } = await params;
		const result = await getQuote(auth.companyId, id);
		if (!result) return jsonError("Quote not found.", 404);
		return NextResponse.json({ ...result });
	} catch (error) {
		return handleRouteError(error);
	}
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const auth = await requireAuth();
		const { id } = await params;
		const parsed = updateQuoteSchema.safeParse(await request.json());
		if (!parsed.success) return jsonError("Quote changes are invalid.", 400, parsed.error.flatten());
		const quote = (
			await db
				.select()
				.from(quotes)
				.where(and(eq(quotes.id, id), eq(quotes.companyId, auth.companyId)))
				.limit(1)
		)[0];
		if (!quote) return jsonError("Quote not found.", 404);
		const current = (
			await db
				.select()
				.from(quoteRevisions)
				.where(
					and(
						eq(quoteRevisions.quoteId, id),
						eq(quoteRevisions.companyId, auth.companyId),
						eq(quoteRevisions.revision, quote.currentRevision),
					),
				)
				.limit(1)
		)[0];
		if (!current) return jsonError("Current quote revision not found.", 404);
		if (["site_visit_required"].includes(quote.status))
			return jsonError("This quote is blocked for a site visit and cannot be edited into a priced quote.", 422);
		const enquiry = (
			await db
				.select()
				.from(enquiries)
				.where(and(eq(enquiries.id, quote.enquiryId), eq(enquiries.companyId, auth.companyId)))
				.limit(1)
		)[0];
		if (!enquiry?.analysis) return jsonError("Enquiry analysis is required before editing this quote.", 422);
		const company = (await db.select().from(companies).where(eq(companies.id, auth.companyId)).limit(1))[0];
		if (!company) return jsonError("Company not found.", 404);
		const catalogueRows = await db.select().from(rates).where(eq(rates.companyId, auth.companyId));
		const catalogue = catalogueRows.map((r) => ({
			id: r.id,
			code: r.code,
			description: r.description,
			unit: r.unit,
			rate: r.rate === null ? null : Number(r.rate),
			status: r.status,
			taxTreatment: r.taxTreatment,
		}));
		const analysis = enquiry.analysis as unknown as JobAnalysis;
		// Editing retains the original requested scope: every extracted item stays represented, priced or explicitly excluded.
		if (parsed.data.lineItems.length < analysis.workItems.length)
			return jsonError(
				"Every extracted work item must remain in the quote; resolve or explicitly exclude it through the review workflow.",
				422,
			);
		const previousItems = current.items as Array<Record<string, unknown>>;
		const lineItemsChanged =
			parsed.data.lineItems.length !== previousItems.length ||
			parsed.data.lineItems.some((item, index) => {
				const previous = previousItems[index] ?? {};
				return (
					item.rateCode !== (typeof previous.rateCode === "string" ? previous.rateCode : null) ||
					item.description !== previous.description ||
					item.quantity !== (typeof previous.quantity === "number" ? previous.quantity : null) ||
					item.unit !== (typeof previous.unit === "string" ? previous.unit : null) ||
					(item.manualUnitRate !== undefined && Number(item.manualUnitRate) !== Number(previous.unitRate)) ||
					Boolean(item.excluded) !== (previous.excluded === true)
				);
			});
		if (lineItemsChanged && !parsed.data.overrideReason?.trim())
			return jsonError("Record a reason for any line-item, unit-rate, or scope change before saving this revision.", 422);
		if (parsed.data.overrideReason?.trim() && parsed.data.overrideReason.trim().length < 10)
			return jsonError("A manual-change reason must contain at least 10 characters.", 422);
		const requestedResolutions = parsed.data.resolvedBlockingReasons ?? [];
		const invalidResolutions = requestedResolutions.filter((reason) => !analysis.missingInformation.includes(reason));
		if (invalidResolutions.length > 0)
			return jsonError(
				"Only listed information requests can be marked resolved; unsupported work and site-visit rules cannot be bypassed.",
				422,
				invalidResolutions,
			);
		const excludedItems = parsed.data.lineItems.filter((item) => item.excluded);
		if ((requestedResolutions.length > 0 || excludedItems.length > 0) && !parsed.data.resolutionNote)
			return jsonError("Add a resolution note of at least 10 characters to explain the human decision or exclusion.", 422);
		const includedItems = parsed.data.lineItems.filter((item) => !item.excluded);
		const manualAnalysis: JobAnalysis = {
			jobType: analysis.jobType,
			summary: analysis.summary,
			workItems: includedItems.map((item) => ({
				description: item.description,
				candidateRateCode: item.rateCode,
				quantity: item.quantity,
				unit: item.unit,
				sourceEvidence: "Human-edited in quote review",
				confidence: 1,
				warnings: [],
			})),
			missingInformation: analysis.missingInformation,
			unsupportedWork: analysis.unsupportedWork,
			siteVisitReasons: analysis.siteVisitReasons,
			assumptions: parsed.data.assumptions ?? analysis.assumptions,
		};
		const priced = buildPricingLines(manualAnalysis, catalogue);
		const pricedLines = priced.lines.map((line, index) => {
			const override = includedItems[index]?.manualUnitRate;
			if (override === undefined || line.unitRate === null || line.lineTotal === null || line.quantity === null) return line;
			return {
				...line,
				unitRate: override,
				lineTotal: roundMoney(override * line.quantity),
				manualRateOverride: Math.abs(override - line.unitRate) > 0.000001,
				overrideReason: parsed.data.overrideReason ?? null,
			};
		});
		const retainedBlockers = [
			...analysis.missingInformation.filter((reason) => !requestedResolutions.includes(reason)),
			...analysis.unsupportedWork.map((x) => `Unsupported work: ${x}`),
			...analysis.siteVisitReasons.map((x) => `Site visit required: ${x}`),
		];
		if (includedItems.length === 0) retainedBlockers.push("At least one included, priced work item must remain in the quote.");
		const blockers = [...new Set([...priced.blockingReasons, ...retainedBlockers])];
		const totals =
			blockers.length === 0
				? calculateTotals({ lines: pricedLines, vatRate: Number(company.vatRate), minimumCharge: Number(company.minimumCharge) })
				: { totals: { subtotal: null, vat: null, total: null }, minimumChargeApplied: false, blockingReasons: [] as string[] };
		blockers.push(...totals.blockingReasons);
		let pricedIndex = 0;
		const items = parsed.data.lineItems.map((item) => {
			if (item.excluded)
				return {
					rateCode: item.rateCode,
					description: item.description,
					quantity: item.quantity,
					unit: item.unit,
					rateId: undefined,
					unitRate: null,
					lineTotal: null,
					taxTreatment: "unknown",
					excluded: true,
					exclusionNote: parsed.data.resolutionNote ?? null,
					sourceEvidence: "Explicitly excluded by reviewer",
				};
			const line = pricedLines[pricedIndex++];
			return { ...line, excluded: false, humanEdited: true, overrideReason: parsed.data.overrideReason ?? null };
		}) as unknown as Record<string, unknown>[];
		const pricingSnapshot = {
			currency: company.currency,
			minimumCharge: Number(company.minimumCharge),
			vatRate: Number(company.vatRate),
			minimumChargeApplied: totals.minimumChargeApplied,
			editedAt: new Date().toISOString(),
			previousRevision: quote.currentRevision,
			rateSnapshot: Object.fromEntries(
				catalogue.map((rate) => [
					rate.code,
					{ id: rate.id, rate: rate.rate, status: rate.status, taxTreatment: rate.taxTreatment, unit: rate.unit },
				]),
			),
			resolvedBlockingReasons: requestedResolutions,
			resolutionNote: parsed.data.resolutionNote ?? null,
			manualRateOverrides: pricedLines
				.filter((line) => "manualRateOverride" in line && line.manualRateOverride === true)
				.map((line) => ({ rateCode: line.rateCode, unitRate: line.unitRate, reason: parsed.data.overrideReason ?? null })),
		};
		const nextStatus = blockers.length > 0 ? "blocked" : "review_required";
		const revisionNo = quote.currentRevision + 1;
		const result = await db.transaction(async (tx) => {
			const [revision] = await tx
				.insert(quoteRevisions)
				.values({
					companyId: auth.companyId,
					quoteId: quote.id,
					revision: revisionNo,
					items,
					subtotal: totals.totals.subtotal === null ? null : totals.totals.subtotal.toFixed(2),
					vatAmount: totals.totals.vat === null ? null : totals.totals.vat.toFixed(2),
					total: totals.totals.total === null ? null : totals.totals.total.toFixed(2),
					vatRate: Number(company.vatRate).toFixed(6),
					notes: parsed.data.notes ?? current.notes,
					assumptions: [
						...(parsed.data.assumptions ?? current.assumptions),
						...excludedItems.map((item) => `Excluded from quoted scope by reviewer: ${item.description}`),
						...(parsed.data.resolutionNote ? [`Human resolution: ${parsed.data.resolutionNote}`] : []),
					],
					blockingReasons: [...new Set(blockers)],
					pricingSnapshot,
					createdBy: auth.userId,
				})
				.returning();
			const [updatedQuote] = await tx
				.update(quotes)
				.set({ currentRevision: revisionNo, status: nextStatus, updatedAt: new Date() })
				.where(
					and(eq(quotes.id, quote.id), eq(quotes.companyId, auth.companyId), eq(quotes.currentRevision, quote.currentRevision)),
				)
				.returning();
			if (!updatedQuote) throw new Error("Quote changed concurrently. Refresh and retry.");
			return { quote: updatedQuote, revision };
		});
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "quote.revised",
			resourceType: "quote",
			resourceId: quote.id,
			metadata: {
				revision: revisionNo,
				blockerCount: blockers.length,
				overrideReason: parsed.data.overrideReason ? "provided" : "not_provided",
			},
		});
		return NextResponse.json({ ...result, blockers: [...new Set(blockers)], totals: totals.totals });
	} catch (error) {
		return handleRouteError(error);
	}
}
