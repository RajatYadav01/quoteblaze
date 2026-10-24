import { createEnquirySchema } from "@quoteblaze/schemas";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";

export async function GET() {
	try {
		const auth = await requireAuth();
		const rows = await db
			.select({ enquiry: schema.enquiries, customerName: schema.customers.name })
			.from(schema.enquiries)
			.leftJoin(
				schema.customers,
				and(eq(schema.customers.id, schema.enquiries.customerId), eq(schema.customers.companyId, auth.companyId)),
			)
			.where(eq(schema.enquiries.companyId, auth.companyId))
			.orderBy(schema.enquiries.createdAt);
		return NextResponse.json({ enquiries: rows });
	} catch (error) {
		return handleRouteError(error);
	}
}

export async function POST(request: Request) {
	try {
		const auth = await requireAuth();
		const parsed = createEnquirySchema.safeParse(await request.json());
		if (!parsed.success) return jsonError("Enquiry is invalid or too long.", 400, parsed.error.flatten());
		const input = parsed.data;
		if (input.customerId) {
			const customer = (
				await db
					.select({ id: schema.customers.id })
					.from(schema.customers)
					.where(and(eq(schema.customers.id, input.customerId), eq(schema.customers.companyId, auth.companyId)))
					.limit(1)
			)[0];
			if (!customer) return jsonError("Selected customer was not found in this company.", 404);
		}
		let customerId = input.customerId ?? null;
		const senderEmail = input.senderEmail || /From:.*<([^>]+)>/i.exec(input.rawText)?.[1] || "";
		if (!customerId && senderEmail) {
			const matches = await db
				.select({ id: schema.customers.id })
				.from(schema.customers)
				.where(and(eq(schema.customers.companyId, auth.companyId), eq(schema.customers.email, senderEmail.toLowerCase())))
				.limit(2);
			if (matches.length === 1) customerId = matches[0].id;
		}
		const subject = input.subject || /^Subject:\s*(.+)$/im.exec(input.rawText)?.[1]?.trim() || "Customer enquiry";
		const senderName = input.senderName || /^From:\s*([^<\n]+?)(?:\s*<|$)/im.exec(input.rawText)?.[1]?.trim() || "";
		const [enquiry] = await db
			.insert(schema.enquiries)
			.values({
				companyId: auth.companyId,
				customerId,
				subject,
				rawText: input.rawText,
				senderEmail: senderEmail ? senderEmail.toLowerCase() : null,
				senderName: senderName || null,
				siteAddress: input.siteAddress || null,
				createdBy: auth.userId,
			})
			.returning();
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "enquiry.created",
			resourceType: "enquiry",
			resourceId: enquiry.id,
			metadata: { subject },
		});
		return NextResponse.json({ enquiry, customerMatched: Boolean(customerId) }, { status: 201 });
	} catch (error) {
		return handleRouteError(error);
	}
}
