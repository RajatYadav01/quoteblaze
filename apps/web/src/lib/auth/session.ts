import "server-only";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@quoteblaze/constants";
import { and, eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";

const { memberships, users, companies } = schema;

function secretBytes(): Uint8Array {
	const value = process.env.AUTH_SECRET;
	if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
	return new TextEncoder().encode(value);
}

export type AuthContext = {
	userId: string;
	email: string;
	fullName: string;
	companyId: string;
	companyName: string;
	role: string;
	canApprove: boolean;
};

export async function createSession(context: AuthContext): Promise<string> {
	return new SignJWT({ companyId: context.companyId, role: context.role, canApprove: context.canApprove })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(context.userId)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_TTL_SECONDS}s`)
		.sign(secretBytes());
}

export async function setSessionCookie(token: string): Promise<void> {
	const jar = await cookies();
	jar.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	});
}

export async function clearSessionCookie(): Promise<void> {
	const jar = await cookies();
	jar.set(SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});
}

export async function getAuthContext(): Promise<AuthContext | null> {
	const jar = await cookies();
	const token = jar.get(SESSION_COOKIE_NAME)?.value;
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, secretBytes());
		if (!payload.sub || typeof payload.companyId !== "string") return null;
		const rows = await db
			.select({
				userId: users.id,
				email: users.email,
				fullName: users.fullName,
				companyId: companies.id,
				companyName: companies.name,
				role: memberships.role,
				canApprove: memberships.canApprove,
			})
			.from(memberships)
			.innerJoin(users, eq(memberships.userId, users.id))
			.innerJoin(companies, eq(memberships.companyId, companies.id))
			.where(and(eq(users.id, payload.sub), eq(companies.id, payload.companyId), eq(users.isActive, true)))
			.limit(1);
		return rows[0] ?? null;
	} catch {
		return null;
	}
}

export async function requireAuth(): Promise<AuthContext> {
	const context = await getAuthContext();
	if (!context) throw new AuthRequiredError();
	return context;
}

export class AuthRequiredError extends Error {
	constructor() {
		super("Authentication required");
		this.name = "AuthRequiredError";
	}
}

export function requireApprovalPermission(context: AuthContext): void {
	if (!context.canApprove && context.role !== "owner" && context.role !== "admin") throw new PermissionDeniedError();
}

export class PermissionDeniedError extends Error {
	constructor() {
		super("You do not have permission to approve quotations.");
		this.name = "PermissionDeniedError";
	}
}
