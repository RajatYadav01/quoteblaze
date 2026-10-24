import { compare } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";

const bodySchema = z.object({ email: z.string().email().max(320), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
	try {
		const parsed = bodySchema.safeParse(await request.json());
		if (!parsed.success) return jsonError("Enter a valid email and password.", 400);
		const email = parsed.data.email.trim().toLowerCase();
		const row = (
			await db
				.select({ user: schema.users, membership: schema.memberships, company: schema.companies })
				.from(schema.users)
				.innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
				.innerJoin(schema.companies, eq(schema.companies.id, schema.memberships.companyId))
				.where(and(sql`lower(${schema.users.email}) = ${email}`, eq(schema.users.isActive, true)))
				.limit(1)
		)[0];
		// Use the same response for unknown email and invalid password.
		if (!row || !(await compare(parsed.data.password, row.user.passwordHash))) return jsonError("Email or password is incorrect.", 401);
		const token = await createSession({
			userId: row.user.id,
			email: row.user.email,
			fullName: row.user.fullName,
			companyId: row.company.id,
			companyName: row.company.name,
			role: row.membership.role,
			canApprove: row.membership.canApprove,
		});
		await setSessionCookie(token);
		await writeAudit({
			companyId: row.company.id,
			actorUserId: row.user.id,
			action: "auth.login",
			resourceType: "user",
			resourceId: row.user.id,
		});
		return NextResponse.json({
			user: { email: row.user.email, fullName: row.user.fullName },
			company: { id: row.company.id, name: row.company.name },
		});
	} catch (error) {
		return handleRouteError(error);
	}
}
