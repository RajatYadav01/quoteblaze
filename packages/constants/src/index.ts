export const APP_NAME = "Quoteblaze";
export const DEFAULT_AI_MODEL = "openrouter/free";
export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_CURRENCY = "GBP";
export const DEFAULT_VAT_RATE = 0.2;
export const DEFAULT_MINIMUM_CHARGE = 450;
export const COMMERCIAL_SITE_VISIT_THRESHOLD_M2 = 500;
export const SESSION_COOKIE_NAME = "quoteblaze_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const MAX_ENQUIRY_CHARS = 30_000;
export const QUOTE_STATUSES = ["draft", "review_required", "blocked", "approved", "site_visit_required"] as const;
export const STOP_REASONS = {
	unknownRate: "One or more required rates are missing or have not been reviewed.",
	missingQuantity: "One or more required quantities need confirming.",
	siteVisit: "This scope requires a site visit before a responsible price can be provided.",
	unsupported: "The enquiry includes work this company has marked as unsupported.",
} as const;
