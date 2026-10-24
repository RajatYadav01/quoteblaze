import "server-only";
import { randomUUID } from "node:crypto";
import { DEFAULT_MINIMUM_CHARGE, DEFAULT_VAT_RATE } from "@quoteblaze/constants";
import { buildPricingLines, calculateTotals, type PriceRate, quoteabilityFor } from "@quoteblaze/pricing-engine";
import type { JobAnalysis, PricingLine } from "@quoteblaze/types";
import { and, desc, eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { db, schema } from "@/lib/db";

const { companies, enquiries, rates, quotes, quoteRevisions, customers } = schema;

function asNumber(value: string | number | null | undefined, fallback = 0): number {
	if (value === null || value === undefined) return fallback;
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function isoQuoteNumber(companyId: string) {
	const shortCompany = companyId.replace(/-/g, "").slice(0, 4).toUpperCase();
	const stamp = new Date()
		.toISOString()
		.replace(/[-:T.Z]/g, "")
		.slice(0, 14);
	return `QT-${shortCompany}-${stamp}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function generateQuoteFromEnquiry(companyId: string, userId: string, enquiryId: string) {
	const enquiry = (
		await db
			.select()
			.from(enquiries)
			.where(and(eq(enquiries.id, enquiryId), eq(enquiries.companyId, companyId)))
			.limit(1)
	)[0];
	if (!enquiry) throw new Error("Enquiry not found.");
	if (!enquiry.analysis) throw new Error("Analyse the enquiry before generating a quote.");
	const existingQuote = (
		await db
			.select()
			.from(quotes)
			.where(and(eq(quotes.companyId, companyId), eq(quotes.enquiryId, enquiry.id)))
			.limit(1)
	)[0];
	if (existingQuote) {
		const existingRevision = (
			await db
				.select()
				.from(quoteRevisions)
				.where(
					and(
						eq(quoteRevisions.companyId, companyId),
						eq(quoteRevisions.quoteId, existingQuote.id),
						eq(quoteRevisions.revision, existingQuote.currentRevision),
					),
				)
				.limit(1)
		)[0];
		if (!existingRevision) throw new Error("Existing quote revision was not found.");
		return {
			quote: existingQuote,
			revision: existingRevision,
			blockers: Array.isArray(existingRevision.blockingReasons) ? existingRevision.blockingReasons : [],
			totals: {
				subtotal: existingRevision.subtotal === null ? null : Number(existingRevision.subtotal),
				vat: existingRevision.vatAmount === null ? null : Number(existingRevision.vatAmount),
				total: existingRevision.total === null ? null : Number(existingRevision.total),
			},
			lineItems: existingRevision.items as unknown as PricingLine[],
		};
	}
	const analysis = enquiry.analysis as unknown as JobAnalysis;
	const company = (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0];
	if (!company) throw new Error("Company configuration not found.");
	const catalogueRows = await db.select().from(rates).where(eq(rates.companyId, companyId));
	const catalogue: PriceRate[] = catalogueRows.map((row) => ({
		id: row.id,
		code: row.code,
		description: row.description,
		unit: row.unit,
		rate: row.rate === null ? null : Number(row.rate),
		status: row.status,
		taxTreatment: row.taxTreatment,
	}));
	const priceBuild = buildPricingLines(analysis, catalogue);
	const threshold = typeof company.settings?.siteVisitThresholdM2 === "number" ? Number(company.settings.siteVisitThresholdM2) : 500;
	const quoteability = quoteabilityFor(analysis, threshold);
	const lineBlockers = priceBuild.blockingReasons;
	const allBlockers = [...new Set([...quoteability.blockingReasons, ...lineBlockers])];
	const canPrice = quoteability.status === "quoteable" && lineBlockers.length === 0 && priceBuild.lines.length > 0;
	const totalsResult = canPrice
		? calculateTotals({
				lines: priceBuild.lines,
				vatRate: asNumber(company.vatRate, DEFAULT_VAT_RATE),
				minimumCharge: asNumber(company.minimumCharge, DEFAULT_MINIMUM_CHARGE),
			})
		: { totals: { subtotal: null, vat: null, total: null }, minimumChargeApplied: false, blockingReasons: [] };
	allBlockers.push(...totalsResult.blockingReasons);
	if (priceBuild.lines.length === 0) allBlockers.push("No rate-backed line items were generated.");
	const blockers = [...new Set(allBlockers)];
	const status =
		quoteability.status === "site_visit_required"
			? "site_visit_required"
			: quoteability.status === "unsupported_work"
				? "blocked"
				: blockers.length > 0
					? "blocked"
					: "review_required";
	const number = isoQuoteNumber(companyId);
	const itemsSnapshot = priceBuild.lines.map((item) => ({ ...item })) as unknown as Record<string, unknown>[];
	const pricingSnapshot = {
		currency: company.currency,
		minimumCharge: asNumber(company.minimumCharge, DEFAULT_MINIMUM_CHARGE),
		vatRate: asNumber(company.vatRate, DEFAULT_VAT_RATE),
		minimumChargeApplied: totalsResult.minimumChargeApplied,
		rateSnapshot: Object.fromEntries(
			catalogue.map((r) => [r.code, { id: r.id, rate: r.rate, status: r.status, taxTreatment: r.taxTreatment, unit: r.unit }]),
		),
	};
	const result = await db.transaction(async (tx) => {
		const [quote] = await tx
			.insert(quotes)
			.values({
				companyId,
				enquiryId: enquiry.id,
				customerId: enquiry.customerId,
				quoteNumber: number,
				status,
				currentRevision: 1,
				createdBy: userId,
			})
			.returning();
		const [revision] = await tx
			.insert(quoteRevisions)
			.values({
				companyId,
				quoteId: quote.id,
				revision: 1,
				items: itemsSnapshot,
				subtotal: totalsResult.totals.subtotal === null ? null : totalsResult.totals.subtotal.toFixed(2),
				vatAmount: totalsResult.totals.vat === null ? null : totalsResult.totals.vat.toFixed(2),
				total: totalsResult.totals.total === null ? null : totalsResult.totals.total.toFixed(2),
				vatRate: asNumber(company.vatRate, DEFAULT_VAT_RATE).toFixed(6),
				notes: analysis.summary,
				assumptions: analysis.assumptions,
				blockingReasons: blockers,
				pricingSnapshot,
				createdBy: userId,
			})
			.returning();
		await tx.update(enquiries).set({ quoteability: quoteability.status, updatedAt: new Date() }).where(eq(enquiries.id, enquiry.id));
		return { quote, revision };
	});
	await writeAudit({
		companyId,
		actorUserId: userId,
		action: "quote.generated",
		resourceType: "quote",
		resourceId: result.quote.id,
		metadata: { status, quoteNumber: number, blockingCount: blockers.length },
	});
	return { ...result, blockers, totals: totalsResult.totals, lineItems: priceBuild.lines as PricingLine[] };
}

export async function listQuotes(companyId: string) {
	const rows = await db
		.select({ quote: quotes, customerName: customers.name, revision: quoteRevisions })
		.from(quotes)
		.leftJoin(customers, and(eq(quotes.customerId, customers.id), eq(customers.companyId, companyId)))
		.leftJoin(
			quoteRevisions,
			and(
				eq(quoteRevisions.quoteId, quotes.id),
				eq(quoteRevisions.revision, quotes.currentRevision),
				eq(quoteRevisions.companyId, companyId),
			),
		)
		.where(eq(quotes.companyId, companyId))
		.orderBy(desc(quotes.createdAt));
	return rows;
}

export async function getQuote(companyId: string, quoteId: string) {
	const row = (
		await db
			.select({
				quote: quotes,
				revision: quoteRevisions,
				customerName: customers.name,
				customerEmail: customers.email,
				enquiryAnalysis: enquiries.analysis,
			})
			.from(quotes)
			.leftJoin(
				quoteRevisions,
				and(
					eq(quoteRevisions.quoteId, quotes.id),
					eq(quoteRevisions.revision, quotes.currentRevision),
					eq(quoteRevisions.companyId, companyId),
				),
			)
			.leftJoin(customers, and(eq(customers.id, quotes.customerId), eq(customers.companyId, companyId)))
			.leftJoin(enquiries, and(eq(enquiries.id, quotes.enquiryId), eq(enquiries.companyId, companyId)))
			.where(and(eq(quotes.id, quoteId), eq(quotes.companyId, companyId)))
			.limit(1)
	)[0];
	return row ?? null;
}
