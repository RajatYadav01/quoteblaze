import { aiCredentialSchema } from "@quoteblaze/schemas";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AiConfigurationError, testOpenRouterKey } from "@/features/ai-analysis/service";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";

export async function GET() {
	try {
		const auth = await requireAuth();
		const credential = (
			await db
				.select({ model: schema.companyAiCredentials.model, lastTestedAt: schema.companyAiCredentials.lastTestedAt })
				.from(schema.companyAiCredentials)
				.where(eq(schema.companyAiCredentials.companyId, auth.companyId))
				.limit(1)
		)[0];
		return NextResponse.json({
			configured: Boolean(credential),
			model: credential?.model ?? "openrouter/free",
			lastTestedAt: credential?.lastTestedAt ?? null,
			maskedKey: credential ? "••••••••••••••••" : null,
		});
	} catch (error) {
		return handleRouteError(error);
	}
}

export async function PUT(request: Request) {
	try {
		const auth = await requireAuth();
		if (!["owner", "admin"].includes(auth.role)) return jsonError("Only company administrators can manage AI credentials.", 403);
		const parsed = aiCredentialSchema.safeParse(await request.json());
		if (!parsed.success)
			return jsonError("AI settings are invalid. Check the API key and OpenRouter model ID.", 400, parsed.error.flatten());

		const existing = (
			await db.select().from(schema.companyAiCredentials).where(eq(schema.companyAiCredentials.companyId, auth.companyId)).limit(1)
		)[0];
		if (!parsed.data.apiKey && !existing) return jsonError("Enter an OpenRouter API key before saving the initial configuration.", 422);
		const apiKey = parsed.data.apiKey ?? decryptSecret(existing!.encryptedKey);

		// Test the selected model before persisting either the model setting or a rotated key.
		await testOpenRouterKey(apiKey, parsed.data.model);
		const encryptedKey = encryptSecret(apiKey);
		const testedAt = new Date();
		await db
			.insert(schema.companyAiCredentials)
			.values({ companyId: auth.companyId, encryptedKey, model: parsed.data.model, lastTestedAt: testedAt, updatedAt: testedAt })
			.onConflictDoUpdate({
				target: schema.companyAiCredentials.companyId,
				set: { encryptedKey, model: parsed.data.model, lastTestedAt: testedAt, updatedAt: testedAt },
			});
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "ai_credentials.updated",
			resourceType: "company_ai_credentials",
			metadata: { model: parsed.data.model, keyRotated: Boolean(parsed.data.apiKey) },
		});
		return NextResponse.json({
			configured: true,
			model: parsed.data.model,
			maskedKey: "••••••••••••••••",
			message: "Connection test succeeded and settings were saved securely.",
		});
	} catch (error) {
		if (error instanceof AiConfigurationError) return jsonError(error.message, 422);
		return handleRouteError(error);
	}
}

export async function DELETE() {
	try {
		const auth = await requireAuth();
		if (!["owner", "admin"].includes(auth.role)) return jsonError("Only company administrators can manage AI credentials.", 403);
		await db.delete(schema.companyAiCredentials).where(eq(schema.companyAiCredentials.companyId, auth.companyId));
		await writeAudit({
			companyId: auth.companyId,
			actorUserId: auth.userId,
			action: "ai_credentials.deleted",
			resourceType: "company_ai_credentials",
		});
		return NextResponse.json({ configured: false });
	} catch (error) {
		return handleRouteError(error);
	}
}
