import { parse } from "csv-parse/sync";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";

function parseMoney(value: unknown): number | null {
	if (typeof value !== "string") return null;
	const v = value.replace(/[£,\s]/g, "");
	if (!v || !/^\d+(\.\d{1,2})?$/.test(v)) return null;
	const n = Number(v);
	return Number.isFinite(n) && n >= 0 ? n : null;
}
function unit(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/m²|sqm/g, "m2")
		.replace(/m³/g, "m3")
		.replace(/lin m/g, "lm");
}
function classify(row: Record<string, string>, amount: number | null) {
	const code = row.Code.trim().toUpperCase();
	const notes = (row.Notes ?? "").toLowerCase();
	if (amount === null || code === "KB04" || code === "TM03" || code === "MI01")
		return {
			status: "inactive",
			taxTreatment: "unknown",
			error:
				code === "MI01"
					? "Minimum charge is applied by Quoteblaze and must not be added as a line item."
					: amount === null
						? "Rate is non-numeric or TBC."
						: "This work is marked unsupported or needs an owner-provided price.",
		};
	const needsReview =
		/old|new price|inc vat|included|same as|check|think|ask dave|subject to|usually|duplicate/.test(notes) ||
		["SB02", "SB03", "BP02", "BP04", "CO02", "EX06", "PT01", "MI02"].includes(code);
	return {
		status: needsReview ? "needs_review" : "active",
		taxTreatment: code === "PT01" ? "inclusive" : needsReview ? "unknown" : "exclusive",
		error: needsReview ? "Ambiguous source note or overlapping price requires review." : "",
	};
}

export async function POST(request: Request) {
	try {
		const auth = await requireAuth();
		if (!(["owner", "admin"] as string[]).includes(auth.role)) return jsonError("Only company administrators can import rates.", 403);
		const form = await request.formData();
		const file = form.get("file");
		if (!(file instanceof File)) return jsonError("Choose a CSV file to import.", 400);
		if (file.size > 2_000_000) return jsonError("CSV must be smaller than 2 MB.", 413);
		const content = await file.text();
		let rows: Record<string, string>[];
		try {
			rows = parse(content, { columns: true, skip_empty_lines: true, bom: true, trim: true });
		} catch {
			return jsonError("Could not parse this CSV. Check its delimiters and quoting.", 400);
		}
		if (rows.length > 2_000) return jsonError("A single import is limited to 2,000 rows.", 413);
		if (rows.length === 0 || !["Code", "Item", "Unit", "Rate"].every((key) => Object.hasOwn(rows[0], key)))
			return jsonError("CSV must include Code, Item, Unit, and Rate columns.", 400);
		const duplicateCodes = new Set(
			rows.map((r) => r.Code?.trim().toUpperCase()).filter((code, index, list) => Boolean(code) && list.indexOf(code) !== index),
		);
		let accepted = 0;
		let review = 0;
		let failed = 0;
		const report = await db.transaction(async (tx) => {
			const [batch] = await tx
				.insert(schema.rateImports)
				.values({ companyId: auth.companyId, fileName: file.name.slice(0, 255), totalRows: rows.length, createdBy: auth.userId })
				.returning();
			for (const [index, row] of rows.entries()) {
				const code = (row.Code ?? "").trim().toUpperCase();
				const description = (row.Item ?? "").trim();
				const rateValue = parseMoney(row.Rate);
				const classification = classify(row, rateValue);
				const errors: string[] = [];
				if (!code || !description || !row.Unit?.trim()) errors.push("Code, Item, and Unit are required.");
				if (duplicateCodes.has(code)) errors.push("This code appears more than once in the uploaded file.");
				const existing = code
					? (
							await tx
								.select({ id: schema.rates.id })
								.from(schema.rates)
								.where(and(eq(schema.rates.companyId, auth.companyId), eq(schema.rates.code, code)))
								.limit(1)
						)[0]
					: undefined;
				if (existing) errors.push("This rate code already exists; import did not overwrite the current rate.");
				let proposedRateId: string | null = null;
				let rowStatus = "accepted";
				if (errors.some((x) => x.includes("required"))) {
					rowStatus = "failed";
					failed++;
				} else if (errors.length > 0 || classification.status !== "active") {
					rowStatus = "needs_review";
					review++;
				} else {
					accepted++;
				}
				if (!errors.some((x) => x.includes("required")) && !existing && !duplicateCodes.has(code)) {
					const [inserted] = await tx
						.insert(schema.rates)
						.values({
							companyId: auth.companyId,
							code,
							description,
							unit: unit(row.Unit),
							rate: rateValue === null ? null : rateValue.toFixed(2),
							status: classification.status,
							taxTreatment: classification.taxTreatment,
							sourceNotes: row.Notes?.trim() || null,
							reviewNotes: classification.error || null,
							sourceRow: row,
						})
						.returning({ id: schema.rates.id });
					proposedRateId = inserted?.id ?? null;
				}
				if (classification.error) errors.push(classification.error);
				await tx.insert(schema.rateImportRows).values({
					importId: batch.id,
					companyId: auth.companyId,
					rowNumber: index + 2,
					rawRow: row,
					proposedRateId,
					status: rowStatus,
					errors,
				});
			}
			await tx
				.update(schema.rateImports)
				.set({ acceptedRows: accepted, reviewRows: review, failedRows: failed, status: "completed" })
				.where(eq(schema.rateImports.id, batch.id));
			return { importId: batch.id, total: rows.length, accepted, review, failed };
		});
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "rates.imported",
			resourceType: "rate_import",
			resourceId: report.importId,
			metadata: report,
		});
		return NextResponse.json({ report }, { status: 201 });
	} catch (error) {
		return handleRouteError(error);
	}
}
