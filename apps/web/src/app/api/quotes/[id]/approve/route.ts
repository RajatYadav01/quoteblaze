import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireApprovalPermission, requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const auth = await requireAuth();
		requireApprovalPermission(auth);
		const { id } = await params;
		const body: unknown = await request.json().catch(() => ({}));
		const note = typeof body === "object" && body && "note" in body && typeof body.note === "string" ? body.note.slice(0, 500) : null;
		const quote = (
			await db
				.select()
				.from(schema.quotes)
				.where(and(eq(schema.quotes.id, id), eq(schema.quotes.companyId, auth.companyId)))
				.limit(1)
		)[0];
		if (!quote) return jsonError("Quote not found.", 404);
		if (quote.status === "approved") return jsonError("This quote revision is already approved.", 409);
		if (quote.status !== "review_required")
			return jsonError("This quote cannot be approved while it is blocked or awaiting a site visit.", 422);
		const revision = (
			await db
				.select()
				.from(schema.quoteRevisions)
				.where(
					and(
						eq(schema.quoteRevisions.quoteId, quote.id),
						eq(schema.quoteRevisions.companyId, auth.companyId),
						eq(schema.quoteRevisions.revision, quote.currentRevision),
					),
				)
				.limit(1)
		)[0];
		if (!revision) return jsonError("Current revision was not found.", 404);
		const blockers = Array.isArray(revision.blockingReasons) ? revision.blockingReasons : [];
		if (blockers.length || revision.total === null || revision.subtotal === null || revision.vatAmount === null)
			return jsonError("Blocking issues remain. Resolve them before approval.", 422, blockers);
		const items = revision.items as Array<Record<string, unknown>>;
		const currentRates = await db.select().from(schema.rates).where(eq(schema.rates.companyId, auth.companyId));
		const snapshot = (revision.pricingSnapshot ?? {}) as Record<string, unknown>;
		const rateSnapshot = (snapshot.rateSnapshot ?? {}) as Record<
			string,
			{ id?: string; rate?: number | null; status?: string; taxTreatment?: string; unit?: string }
		>;
		const company = (await db.select().from(schema.companies).where(eq(schema.companies.id, auth.companyId)).limit(1))[0];
		if (!company) return jsonError("Company not found.", 404);
		if (
			Number(snapshot.vatRate) !== Number(company.vatRate) ||
			Number(snapshot.minimumCharge) !== Number(company.minimumCharge) ||
			snapshot.currency !== company.currency
		)
			return jsonError(
				"Company pricing settings changed since this revision was calculated. Save a new revision before approval.",
				409,
			);
		for (const item of items) {
			if (item.excluded === true) {
				if (typeof item.exclusionNote !== "string" || item.exclusionNote.trim().length < 10)
					return jsonError("An excluded quote item is missing its human exclusion note.", 422);
				continue;
			}
			if (item.manualRateOverride === true && (typeof item.overrideReason !== "string" || item.overrideReason.trim().length < 10))
				return jsonError("A manually overridden unit rate needs a recorded human reason.", 422);
			if (typeof item.rateCode !== "string") return jsonError("A quote line has no verified rate code.", 422);
			if (item.rateCode.toUpperCase() === "MI01")
				return jsonError("The minimum charge must not be represented as a priced line item.", 422);
			const live = currentRates.find((rate) => rate.code === item.rateCode);
			const saved = rateSnapshot[item.rateCode];
			if (!live || !saved || live.status !== "active" || live.taxTreatment === "unknown")
				return jsonError(`Rate ${item.rateCode} is no longer approved. Revise this quote first.`, 409);
			if (
				live.id !== saved.id ||
				Number(live.rate) !== Number(saved.rate) ||
				live.taxTreatment !== saved.taxTreatment ||
				live.unit !== saved.unit
			)
				return jsonError(`Rate ${item.rateCode} changed since draft generation. Revise and re-approve the quote.`, 409);
		}
		const result = await db.transaction(async (tx) => {
			// Compare-and-set protects against two concurrent approval requests or a stale revision.
			const changed = await tx
				.update(schema.quotes)
				.set({ status: "approved", updatedAt: new Date() })
				.where(
					and(
						eq(schema.quotes.id, quote.id),
						eq(schema.quotes.companyId, auth.companyId),
						eq(schema.quotes.currentRevision, revision.revision),
						eq(schema.quotes.status, "review_required"),
					),
				)
				.returning();
			if (!changed[0]) throw new Error("Quote changed while approval was being processed. Refresh and retry.");
			const [approval] = await tx
				.insert(schema.approvals)
				.values({ companyId: auth.companyId, quoteId: quote.id, revisionId: revision.id, approvedBy: auth.userId, note })
				.returning();
			await tx.insert(schema.auditEvents).values({
				companyId: auth.companyId,
				actorUserId: auth.userId,
				action: "quote.approved",
				resourceType: "quote",
				resourceId: quote.id,
				metadata: { revision: revision.revision },
			});
			return { quote: changed[0], approval };
		});
		return NextResponse.json({ ...result, message: "Quote approved internally. No customer email was sent." });
	} catch (error) {
		return handleRouteError(error);
	}
}
