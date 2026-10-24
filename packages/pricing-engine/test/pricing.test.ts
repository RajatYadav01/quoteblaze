import type { JobAnalysis } from "@quoteblaze/types";
import { describe, expect, it } from "vitest";
import { buildPricingLines, calculateTotals, isAllowedRate, quoteabilityFor, squareFeetToSquareMetres } from "../src/index";

const analysis: JobAnalysis = {
	jobType: "Patio replacement",
	summary: "Replace 18 m2 concrete patio with porcelain.",
	workItems: [
		{
			description: "Break out concrete",
			candidateRateCode: "EX04",
			quantity: 18,
			unit: "m2",
			sourceEvidence: "about 18 sq m",
			confidence: 0.9,
			warnings: [],
		},
	],
	missingInformation: [],
	unsupportedWork: [],
	siteVisitReasons: [],
	assumptions: [],
};
const rate = {
	id: "rate-1",
	code: "EX04",
	description: "Break out concrete",
	unit: "m2",
	rate: 24,
	status: "active",
	taxTreatment: "exclusive",
};

describe("pricing engine", () => {
	it("converts 20ft x 15ft to approximately 27.87 square metres", () => {
		expect(20 * 15 * 0.09290304).toBeCloseTo(27.87, 2);
		expect(squareFeetToSquareMetres(300)).toBeCloseTo(27.870912, 5);
	});
	it("prices only active, reviewed rates with known tax treatment", () => {
		expect(buildPricingLines(analysis, [rate]).lines[0]?.lineTotal).toBe(432);
		const inactive = { ...rate, status: "needs_review" };
		expect(buildPricingLines(analysis, [inactive]).blockingReasons).toContain(
			"EX04 is not approved for quoting (needs_review; tax treatment exclusive).",
		);
	});
	it("blocks unit mismatches instead of silently converting units", () => {
		const mismatch = { ...analysis, workItems: [{ ...analysis.workItems[0]!, unit: "lm" }] };
		expect(buildPricingLines(mismatch, [rate]).blockingReasons[0]).toContain("Unit mismatch");
	});
	it("applies the minimum charge before calculating VAT", () => {
		const result = calculateTotals({
			lines: [
				{
					rateCode: "SMALL",
					description: "Small job",
					quantity: 1,
					unit: "job",
					unitRate: 120,
					lineTotal: 120,
					taxTreatment: "exclusive",
				},
			],
			vatRate: 0.2,
			minimumCharge: 450,
		});
		expect(result.minimumChargeApplied).toBe(true);
		expect(result.totals).toEqual({ subtotal: 450, vat: 90, total: 540 });
	});
	it("handles VAT-inclusive legacy line items without adding VAT twice", () => {
		const result = calculateTotals({
			lines: [
				{
					rateCode: "PT01",
					description: "Legacy inc VAT",
					quantity: 1,
					unit: "m2",
					unitRate: 85,
					lineTotal: 85,
					taxTreatment: "inclusive",
				},
			],
			vatRate: 0.2,
			minimumCharge: 0,
			applyMinimum: false,
		});
		expect(result.totals.subtotal).toBeCloseTo(70.83, 2);
		expect(result.totals.vat).toBeCloseTo(14.17, 2);
		expect(result.totals.total).toBe(85);
	});
	it("does not make a site visit or unsupported-work decision quoteable", () => {
		const greenway: JobAnalysis = {
			...analysis,
			jobType: "Commercial car park",
			summary: "1200 m2 car park resurfacing",
			siteVisitReasons: ["Large commercial scope"],
		};
		expect(quoteabilityFor(greenway).status).toBe("site_visit_required");
		const kerb: JobAnalysis = { ...analysis, unsupportedWork: ["Dropped kerb"] };
		expect(quoteabilityFor(kerb).status).toBe("unsupported_work");
	});
	it("keeps the minimum-charge pseudo-rate out of quote line items", () => {
		expect(
			isAllowedRate({
				id: "min",
				code: "MI01",
				description: "Minimum charge",
				unit: "job",
				rate: 450,
				status: "active",
				taxTreatment: "exclusive",
			}),
		).toBe(false);
	});
});
