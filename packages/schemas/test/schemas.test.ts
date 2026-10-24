import { describe, expect, it } from "vitest";
import { aiCredentialSchema, createEnquirySchema, jobAnalysisSchema } from "../src/index";

describe("shared schemas", () => {
	it("rejects empty or excessively short enquiry text", () => {
		expect(createEnquirySchema.safeParse({ rawText: "Hi" }).success).toBe(false);
	});
	it("validates typed AI analysis and rejects impossible confidence values", () => {
		const valid = {
			jobType: "Driveway",
			summary: "Extend driveway",
			workItems: [
				{
					description: "Paving",
					candidateRateCode: "BP01",
					quantity: 20,
					unit: "m2",
					sourceEvidence: "20 square metres",
					confidence: 0.8,
					warnings: [],
				},
			],
			missingInformation: [],
			unsupportedWork: [],
			siteVisitReasons: [],
			assumptions: [],
		};
		expect(jobAnalysisSchema.safeParse(valid).success).toBe(true);
		expect(jobAnalysisSchema.safeParse({ ...valid, workItems: [{ ...valid.workItems[0], confidence: 2 }] }).success).toBe(false);
	});
});

describe("OpenRouter model configuration", () => {
	it("accepts provider-qualified paid models and free variants", () => {
		expect(aiCredentialSchema.safeParse({ apiKey: "sk-or-v1-example-key-value", model: "anthropic/claude-sonnet-4" }).success).toBe(
			true,
		);
		expect(aiCredentialSchema.safeParse({ apiKey: "sk-or-v1-example-key-value", model: "openai/gpt-4o:latest" }).success).toBe(true);
		expect(aiCredentialSchema.safeParse({ model: "google/gemini-2.5-pro" }).success).toBe(true);
	});
	it("rejects model IDs with spaces or empty provider/model slugs", () => {
		expect(aiCredentialSchema.safeParse({ model: "not a model" }).success).toBe(false);
		expect(aiCredentialSchema.safeParse({ model: "plain-model-without-provider" }).success).toBe(false);
		expect(aiCredentialSchema.safeParse({ model: "" }).success).toBe(false);
	});
});
