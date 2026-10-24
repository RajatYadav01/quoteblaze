import { ratePatchSchema } from "@quoteblaze/schemas";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const auth = await requireAuth();
		const { id } = await params;
		if (!(["owner", "admin"] as string[]).includes(auth.role))
			return jsonError("Only company administrators can manage the rate catalogue.", 403);
		const parsed = ratePatchSchema.safeParse(await request.json());
		if (!parsed.success) return jsonError("Rate update is invalid.", 400, parsed.error.flatten());
		if (Object.keys(parsed.data).length === 0) return jsonError("No rate changes supplied.", 400);
		const current = (
			await db
				.select({
					id: schema.rates.id,
					code: schema.rates.code,
					rate: schema.rates.rate,
					status: schema.rates.status,
					taxTreatment: schema.rates.taxTreatment,
				})
				.from(schema.rates)
				.where(and(eq(schema.rates.id, id), eq(schema.rates.companyId, auth.companyId)))
				.limit(1)
		)[0];
		if (!current) return jsonError("Rate not found.", 404);
		const nextStatus = parsed.data.status ?? current.status;
		const nextTaxTreatment = parsed.data.taxTreatment ?? current.taxTreatment;
		const nextRate = parsed.data.rate !== undefined ? parsed.data.rate : current.rate === null ? null : Number(current.rate);
		if (current.code.toUpperCase() === "MI01" && nextStatus === "active")
			return jsonError("MI01 is handled by the minimum-charge rule and cannot be activated as a quote line.", 422);
		if (current.code.toUpperCase() === "KB04" && nextStatus === "active")
			return jsonError("Dropped kerbs are unsupported by this company and cannot be activated as a quote line.", 422);
		if (nextStatus === "active" && (nextRate === null || nextTaxTreatment === "unknown"))
			return jsonError("A rate can be activated only after its amount and VAT treatment are resolved.", 422);
		const { notes, ...patch } = parsed.data;
		const values = {
			...patch,
			...(notes !== undefined ? { reviewNotes: notes || null } : {}),
			updatedAt: new Date(),
			...(parsed.data.rate !== undefined ? { rate: parsed.data.rate === null ? null : parsed.data.rate.toFixed(2) } : {}),
		};
		const rows = await db
			.update(schema.rates)
			.set(values)
			.where(and(eq(schema.rates.id, id), eq(schema.rates.companyId, auth.companyId)))
			.returning();
		if (!rows[0]) return jsonError("Rate not found.", 404);
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "rate.updated",
			resourceType: "rate",
			resourceId: rows[0].id,
			metadata: { fields: Object.keys(parsed.data) },
		});
		return NextResponse.json({ rate: rows[0] });
	} catch (error) {
		return handleRouteError(error);
	}
}
