import { aiModelSearchSchema } from "@quoteblaze/schemas";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { decryptSecret } from "@/lib/security/credentials";

const openRouterModelsResponseSchema = z.object({
	data: z.array(
		z
			.object({
				id: z.string(),
				name: z.string().optional(),
				context_length: z.number().nullable().optional(),
				pricing: z.object({ prompt: z.string().optional(), completion: z.string().optional() }).optional(),
				architecture: z
					.object({ input_modalities: z.array(z.string()).optional(), output_modalities: z.array(z.string()).optional() })
					.optional(),
			})
			.passthrough(),
	),
});

function perMillionTokens(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed * 1_000_000 : null;
}

export async function POST(request: Request) {
	try {
		const auth = await requireAuth();
		if (!["owner", "admin"].includes(auth.role)) return jsonError("Only company administrators can browse model configuration.", 403);
		const parsed = aiModelSearchSchema.safeParse(await request.json());
		if (!parsed.success) return jsonError("Model search request is invalid.", 400, parsed.error.flatten());

		let apiKey = parsed.data.apiKey;
		if (!apiKey) {
			const credential = (
				await db
					.select({ encryptedKey: schema.companyAiCredentials.encryptedKey })
					.from(schema.companyAiCredentials)
					.where(eq(schema.companyAiCredentials.companyId, auth.companyId))
					.limit(1)
			)[0];
			if (!credential)
				return jsonError(
					"Enter an OpenRouter API key or save one before browsing the catalogue. You can also enter a model ID manually.",
					422,
				);
			apiKey = decryptSecret(credential.encryptedKey);
		}

		const url = new URL("https://openrouter.ai/api/v1/models");
		if (parsed.data.query) url.searchParams.set("q", parsed.data.query);
		url.searchParams.set("input_modalities", "text");
		url.searchParams.set("output_modalities", "text");
		url.searchParams.set("sort", "most-popular");
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
				"X-OpenRouter-Title": "Quoteblaze",
			},
			cache: "no-store",
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) {
			if (response.status === 401 || response.status === 403)
				return jsonError("OpenRouter rejected this key while listing models.", 422);
			if (response.status === 429) return jsonError("OpenRouter rate limit reached while loading models. Try again shortly.", 429);
			return jsonError(`Could not load OpenRouter models (${response.status}). You can still enter a model ID manually.`, 502);
		}
		const upstream: unknown = await response.json();
		const catalog = openRouterModelsResponseSchema.safeParse(upstream);
		if (!catalog.success) return jsonError("OpenRouter returned an unexpected model catalogue response.", 502);
		const models = catalog.data.data
			.filter(
				(model) => !parsed.data.query || `${model.id} ${model.name ?? ""}`.toLowerCase().includes(parsed.data.query.toLowerCase()),
			)
			.slice(0, 60)
			.map((model) => ({
				id: model.id,
				name: model.name ?? model.id,
				contextLength: model.context_length ?? null,
				promptUsdPerMillion: perMillionTokens(model.pricing?.prompt),
				completionUsdPerMillion: perMillionTokens(model.pricing?.completion),
				inputModalities: model.architecture?.input_modalities ?? ["text"],
				outputModalities: model.architecture?.output_modalities ?? ["text"],
			}));
		return NextResponse.json({ models });
	} catch (error) {
		return handleRouteError(error);
	}
}
