export type CompanyRole = "owner" | "admin" | "reviewer";
export type RateStatus = "active" | "needs_review" | "inactive";
export type TaxTreatment = "exclusive" | "inclusive" | "unknown";
export type QuoteStatus = "draft" | "review_required" | "blocked" | "approved" | "site_visit_required";
export type Quoteability = "quoteable" | "needs_information" | "site_visit_required" | "unsupported_work";

export type AnalysisWorkItem = {
	description: string;
	candidateRateCode: string | null;
	quantity: number | null;
	unit: string | null;
	sourceEvidence: string;
	confidence: number;
	warnings: string[];
};

export type JobAnalysis = {
	jobType: string;
	workItems: AnalysisWorkItem[];
	missingInformation: string[];
	unsupportedWork: string[];
	siteVisitReasons: string[];
	assumptions: string[];
	summary: string;
};

export type PricingLine = {
	rateId?: string;
	rateCode: string | null;
	description: string;
	quantity: number | null;
	unit: string | null;
	unitRate: number | null;
	taxTreatment?: TaxTreatment;
	lineTotal: number | null;
	blockingReason?: string;
	sourceEvidence?: string;
};

export type QuoteTotals = {
	subtotal: number | null;
	vat: number | null;
	total: number | null;
};
