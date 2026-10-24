import { aiCredentialSchema } from "@quoteblaze/schemas";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AiConfigurationError, testOpenRouterKey } from "@/features/ai-analysis/service";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { decryptSecret } from "@/lib/security/credentials";

export async function POST(request: Request) {
	try {
		const auth = await requireAuth();
		if (!(["owner", "admin"] as string[]).includes(auth.role))
			return jsonError("Only company administrators can test AI credentials.", 403);
		let key: string;
		let model: string;
		const body: unknown = await request.json();
		if (body && typeof body === "object" && "apiKey" in body) {
			const parsed = aiCredentialSchema.safeParse(body);
			if (!parsed.success) return jsonError("AI settings are invalid.", 400, parsed.error.flatten());
			if (!parsed.data.apiKey) return jsonError("Provide the API key to test, or omit the body to test saved settings.", 400);
			key = parsed.data.apiKey;
			model = parsed.data.model;
		} else {
			const record = (
				await db
					.select()
					.from(schema.companyAiCredentials)
					.where(eq(schema.companyAiCredentials.companyId, auth.companyId))
					.limit(1)
			)[0];
			if (!record) return jsonError("Save an OpenRouter API key before testing.", 422);
			key = decryptSecret(record.encryptedKey);
			model = record.model;
		}
		await testOpenRouterKey(key, model);
		await db
			.update(schema.companyAiCredentials)
			.set({ lastTestedAt: new Date(), updatedAt: new Date() })
			.where(eq(schema.companyAiCredentials.companyId, auth.companyId));
		return NextResponse.json({ ok: true, model, message: "OpenRouter key and model are responding." });
	} catch (error) {
		if (error instanceof AiConfigurationError) return jsonError(error.message, 422);
		return handleRouteError(error);
	}
}
