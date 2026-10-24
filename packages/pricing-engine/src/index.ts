import { COMMERCIAL_SITE_VISIT_THRESHOLD_M2 } from "@quoteblaze/constants";
import type { JobAnalysis, PricingLine, QuoteTotals } from "@quoteblaze/types";

export type PriceRate = {
	id: string;
	code: string;
	description: string;
	unit: string;
	rate: number | null;
	status: string;
	taxTreatment: string;
};

export function normalizeUnit(unit: string | null | undefined): string {
	const value = (unit ?? "")
		.trim()
		.toLowerCase()
		.replace(/m²|sqm/g, "m2")
		.replace(/m³/g, "m3")
		.replace(/linear metres?|lin m/g, "lm")
		.replace(/\s/g, "");
	const aliases: Record<string, string> = {
		m: "lm",
		metre: "lm",
		meter: "lm",
		squaremetre: "m2",
		squaremeter: "m2",
		each: "each",
		job: "job",
		load: "load",
		tonne: "tonne",
		day: "day",
	};
	return aliases[value] ?? value;
}

export function toMetres(value: number, unit: string): number | null {
	const key = unit.trim().toLowerCase().replace(/\s/g, "");
	if (["ft", "feet", "foot", "'"].includes(key)) return value * 0.3048;
	if (["m", "metre", "metres", "meter", "meters"].includes(key)) return value;
	return null;
}

export function squareFeetToSquareMetres(value: number): number {
	return value * 0.09290304;
}

export function roundMoney(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isAllowedRate(rate: PriceRate): boolean {
	return (
		rate.code.toUpperCase() !== "MI01" &&
		rate.status === "active" &&
		rate.rate !== null &&
		rate.rate >= 0 &&
		rate.taxTreatment !== "unknown"
	);
}

export function applyDeterministicGuards(
	analysis: JobAnalysis,
	rawText: string,
	thresholdM2 = COMMERCIAL_SITE_VISIT_THRESHOLD_M2,
): JobAnalysis {
	const next: JobAnalysis = {
		...analysis,
		missingInformation: [...analysis.missingInformation],
		unsupportedWork: [...analysis.unsupportedWork],
		siteVisitReasons: [...analysis.siteVisitReasons],
		assumptions: [...analysis.assumptions],
		workItems: analysis.workItems.map((item) => ({ ...item, warnings: [...item.warnings] })),
	};
	const text = rawText.toLowerCase().replace(/,/g, "");
	// Clear feet-by-feet dimensions are converted by code, not delegated to the model.
	const dimensions = /\b(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')\b/.exec(text);
	if (dimensions) {
		const lengthFt = Number(dimensions[1]);
		const widthFt = Number(dimensions[2]);
		const sqft = lengthFt * widthFt;
		const areaM2 = squareFeetToSquareMetres(sqft);
		const areaTerms = /pav|drive|excavat|sub.?base|membrane|grass|lawn|turf|patio|tarmac|resin|surface/.test(text);
		if (Number.isFinite(areaM2) && areaTerms) {
			next.workItems = next.workItems.map((item) => {
				if (
					normalizeUnit(item.unit) !== "m2" ||
					!/pav|drive|excavat|sub.?base|membrane|grass|lawn|turf|patio|tarmac|resin|surface/i.test(
						`${item.description} ${item.sourceEvidence}`,
					)
				)
					return item;
				const usesRawSquareFeet = item.quantity !== null && Math.abs(item.quantity - sqft) < 0.05;
				const mentionsDimension = `${item.sourceEvidence} ${item.description}`.includes(dimensions[0]);
				if (item.quantity === null || usesRawSquareFeet || mentionsDimension) {
					return {
						...item,
						quantity: roundMoney(areaM2),
						unit: "m2",
						warnings: [
							...new Set([
								...item.warnings,
								`Converted ${lengthFt} ft × ${widthFt} ft to ${roundMoney(areaM2)} m² deterministically.`,
							]),
						],
					};
				}
				return item;
			});
		}
	}
	const areaMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(m2|sqm|square metres?|square meters?)/g)];
	const largeArea = areaMatches.some((match) => Number(match[1]) >= thresholdM2);
	if (largeArea && /car ?park|commercial|care home/.test(text)) {
		next.siteVisitReasons.push(`Large commercial site exceeds the configured ${thresholdM2} m² site-visit threshold.`);
	}
	if (
		/new dropped kerb|new vehicle crossover|install(?:ation)? of (?:a )?dropped kerb|we(?:'d| would) also like (?:a )?new? dropped kerb/.test(
			text,
		)
	) {
		next.unsupportedWork.push("Dropped kerb / vehicle crossover is not offered by this contractor.");
	}
	if (/resin bound/.test(text))
		next.missingInformation.push("Resin-bound surfacing price is marked TBC; confirm a current rate with the owner.");
	if (/skip[^.\n]{0,100}road|road[^.\n]{0,100}skip/.test(text))
		next.missingInformation.push("Confirm whether the skip requires a road permit; the price-list note adds £60 if required.");
	if (/outside tap|move the tap|relocat(?:e|ing) (?:an? )?outside tap/.test(text))
		next.missingInformation.push("Confirm whether outside tap relocation is offered and obtain an approved price.");
	if (/herringbone/.test(text) && next.workItems.some((item) => item.candidateRateCode?.toUpperCase() === "BP01")) {
		next.missingInformation.push(
			"BP01 notes a £4/m² herringbone surcharge; confirm the surcharge is included in the reviewed unit rate.",
		);
	}
	if (
		/edging|edging kerb|kerb along/.test(text) &&
		!next.workItems.some((item) => /^(KB01|KB02|KB03)$/i.test(item.candidateRateCode ?? "") || /edging|kerb/i.test(item.description))
	) {
		next.missingInformation.push(
			"Confirm the linear measurement and suitable edging rate; do not estimate the kerb length from the surface area.",
		);
	}
	const dedupe = (list: string[]) => [...new Set(list)];
	next.missingInformation = dedupe(next.missingInformation);
	next.unsupportedWork = dedupe(next.unsupportedWork);
	next.siteVisitReasons = dedupe(next.siteVisitReasons);
	return next;
}

export function quoteabilityFor(
	analysis: JobAnalysis,
	siteVisitThresholdM2 = COMMERCIAL_SITE_VISIT_THRESHOLD_M2,
): {
	status: "quoteable" | "needs_information" | "site_visit_required" | "unsupported_work";
	blockingReasons: string[];
} {
	const reasons: string[] = [];
	const allText = `${analysis.jobType} ${analysis.summary} ${analysis.siteVisitReasons.join(" ")}`.toLowerCase();
	const areaMatch = allText.match(/\b(\d+(?:\.\d+)?)\s*(?:m2|square metres?|square meters?)\b/);
	const largeArea = areaMatch ? Number(areaMatch[1]) >= siteVisitThresholdM2 : false;
	const commercial = /car park|carpark|commercial|care home|industrial estate/.test(allText);
	if (analysis.unsupportedWork.length > 0) reasons.push(...analysis.unsupportedWork.map((x) => `Unsupported: ${x}`));
	if (analysis.siteVisitReasons.length > 0 || (commercial && largeArea))
		reasons.push(
			...analysis.siteVisitReasons,
			...(commercial && largeArea ? [`Commercial scope exceeds ${siteVisitThresholdM2} m² threshold.`] : []),
		);
	if (analysis.siteVisitReasons.length > 0 || (commercial && largeArea))
		return { status: "site_visit_required", blockingReasons: [...new Set(reasons)] };
	if (analysis.unsupportedWork.length > 0) return { status: "unsupported_work", blockingReasons: [...new Set(reasons)] };
	if (analysis.missingInformation.length > 0 || analysis.workItems.some((item) => item.quantity === null || item.unit === null)) {
		reasons.push(...analysis.missingInformation);
		return { status: "needs_information", blockingReasons: [...new Set(reasons)] };
	}
	return { status: "quoteable", blockingReasons: [] };
}

export function buildPricingLines(analysis: JobAnalysis, catalogue: PriceRate[]): { lines: PricingLine[]; blockingReasons: string[] } {
	const lines: PricingLine[] = [];
	const blockingReasons: string[] = [];
	const byCode = new Map(catalogue.map((rate) => [rate.code.toLowerCase(), rate]));
	for (const item of analysis.workItems) {
		const rate = item.candidateRateCode ? byCode.get(item.candidateRateCode.toLowerCase()) : undefined;
		if (!rate) {
			const reason = item.candidateRateCode
				? `Rate ${item.candidateRateCode} was not found in this company's catalogue.`
				: `No rate selected for “${item.description}”.`;
			lines.push({
				rateCode: item.candidateRateCode,
				description: item.description,
				quantity: item.quantity,
				unit: item.unit,
				unitRate: null,
				lineTotal: null,
				taxTreatment: "unknown",
				blockingReason: reason,
				sourceEvidence: item.sourceEvidence,
			});
			blockingReasons.push(reason);
			continue;
		}
		if (!isAllowedRate(rate)) {
			const reason = `${rate.code} is not approved for quoting (${rate.status}; tax treatment ${rate.taxTreatment}).`;
			lines.push({
				rateId: rate.id,
				rateCode: rate.code,
				description: item.description,
				quantity: item.quantity,
				unit: item.unit ?? rate.unit,
				unitRate: rate.rate,
				lineTotal: null,
				taxTreatment: "unknown",
				blockingReason: reason,
				sourceEvidence: item.sourceEvidence,
			});
			blockingReasons.push(reason);
			continue;
		}
		if (item.quantity === null || !item.unit) {
			const reason = `Quantity or unit is missing for ${rate.code}.`;
			lines.push({
				rateId: rate.id,
				rateCode: rate.code,
				description: item.description,
				quantity: item.quantity,
				unit: item.unit ?? rate.unit,
				unitRate: rate.rate,
				lineTotal: null,
				taxTreatment: "unknown",
				blockingReason: reason,
				sourceEvidence: item.sourceEvidence,
			});
			blockingReasons.push(reason);
			continue;
		}
		if (normalizeUnit(item.unit) !== normalizeUnit(rate.unit)) {
			const reason = `Unit mismatch for ${rate.code}: enquiry uses ${item.unit}, rate catalogue uses ${rate.unit}.`;
			lines.push({
				rateId: rate.id,
				rateCode: rate.code,
				description: item.description,
				quantity: item.quantity,
				unit: item.unit,
				unitRate: rate.rate,
				lineTotal: null,
				taxTreatment: "unknown",
				blockingReason: reason,
				sourceEvidence: item.sourceEvidence,
			});
			blockingReasons.push(reason);
			continue;
		}
		lines.push({
			rateId: rate.id,
			rateCode: rate.code,
			description: item.description,
			quantity: item.quantity,
			unit: item.unit,
			unitRate: rate.rate,
			taxTreatment: rate.taxTreatment as PricingLine["taxTreatment"],
			lineTotal: roundMoney(item.quantity * (rate.rate ?? 0)),
			sourceEvidence: item.sourceEvidence,
		});
	}
	return { lines, blockingReasons: [...new Set(blockingReasons)] };
}

export function calculateTotals(options: {
	lines: PricingLine[];
	vatRate: number;
	minimumCharge: number;
	taxTreatment?: "exclusive" | "inclusive" | "unknown";
	applyMinimum?: boolean;
}): { totals: QuoteTotals; minimumChargeApplied: boolean; blockingReasons: string[] } {
	const blockingReasons = options.lines
		.filter((line) => line.blockingReason || line.lineTotal === null)
		.map((line) => line.blockingReason ?? `Line ${line.description} is incomplete.`);
	if (options.taxTreatment === "unknown") blockingReasons.push("VAT treatment is unresolved.");
	for (const line of options.lines)
		if ((line.taxTreatment ?? options.taxTreatment ?? "unknown") === "unknown")
			blockingReasons.push(`VAT treatment is unresolved for ${line.rateCode ?? line.description}.`);
	if (blockingReasons.length > 0)
		return {
			totals: { subtotal: null, vat: null, total: null },
			minimumChargeApplied: false,
			blockingReasons: [...new Set(blockingReasons)],
		};

	let subtotal = 0;
	let vat = 0;
	for (const line of options.lines) {
		const amount = line.lineTotal ?? 0;
		const treatment = line.taxTreatment ?? options.taxTreatment ?? "exclusive";
		if (treatment === "inclusive") {
			const net = amount / (1 + options.vatRate);
			subtotal += net;
			vat += amount - net;
		} else {
			subtotal += amount;
			vat += amount * options.vatRate;
		}
	}
	subtotal = roundMoney(subtotal);
	vat = roundMoney(vat);
	const minimumChargeApplied = options.applyMinimum !== false && subtotal < options.minimumCharge;
	if (minimumChargeApplied) {
		const topUp = roundMoney(options.minimumCharge - subtotal);
		subtotal = options.minimumCharge;
		vat = roundMoney(vat + topUp * options.vatRate);
	}
	return { totals: { subtotal, vat, total: roundMoney(subtotal + vat) }, minimumChargeApplied, blockingReasons: [] };
}
