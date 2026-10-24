import { z } from "zod";

export const workItemSchema = z.object({
  description: z.string().min(1).max(500),
  candidateRateCode: z.string().max(30).nullable(),
  quantity: z.number().positive().nullable(),
  unit: z.string().max(40).nullable(),
  sourceEvidence: z.string().max(1000).default(""),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().max(500)).default([]),
});

export const jobAnalysisSchema = z.object({
  jobType: z.string().min(1).max(200),
  workItems: z.array(workItemSchema).max(50),
  missingInformation: z.array(z.string().max(500)).max(50),
  unsupportedWork: z.array(z.string().max(500)).max(50),
  siteVisitReasons: z.array(z.string().max(500)).max(50),
  assumptions: z.array(z.string().max(500)).max(50),
  summary: z.string().max(2000),
});

export const createEnquirySchema = z.object({
  rawText: z.string().trim().min(20).max(30000),
  subject: z.string().trim().max(300).optional().default(""),
  senderEmail: z.email().max(320).optional().or(z.literal("")),
  senderName: z.string().trim().max(200).optional().default(""),
  siteAddress: z.string().trim().max(500).optional().default(""),
  customerId: z.uuid().optional().nullable(),
});

export const updateQuoteSchema = z.object({
  notes: z.string().max(5000).optional(),
  assumptions: z.array(z.string().max(500)).max(50).optional(),
  lineItems: z.array(z.object({
    id: z.uuid().optional(),
    rateCode: z.string().max(30).nullable(),
    description: z.string().min(1).max(500),
    quantity: z.number().positive().nullable(),
    unit: z.string().max(40).nullable(),
    excluded: z.boolean().optional().default(false),
    manualUnitRate: z.number().nonnegative().max(1_000_000).optional(),
  })).max(50),
  overrideReason: z.string().max(500).optional(),
  resolvedBlockingReasons: z.array(z.string().max(500)).max(50).optional(),
  resolutionNote: z.string().trim().min(10).max(1000).optional(),
});

// OpenRouter model IDs are provider/model slugs, optionally followed by a variant such as :free.
// Keep the accepted character set intentionally aligned with public model IDs; availability is
// verified by the live connection test rather than hard-coded into the application.
export const openRouterModelIdSchema = z.string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Enter a provider-qualified OpenRouter model ID, for example anthropic/claude-sonnet-4.");

export const aiCredentialSchema = z.object({
  // Optional on update: when omitted, the server reuses this company's encrypted saved key.
  apiKey: z.string().trim().min(10).max(500).optional(),
  model: openRouterModelIdSchema.default("openrouter/free"),
});

export const aiModelSearchSchema = z.object({
  apiKey: z.string().trim().min(10).max(500).optional(),
  query: z.string().trim().max(100).default(""),
});

export const ratePatchSchema = z.object({
  status: z.enum(["active", "needs_review", "inactive"]).optional(),
  rate: z.number().nonnegative().nullable().optional(),
  unit: z.string().min(1).max(50).optional(),
  taxTreatment: z.enum(["exclusive", "inclusive", "unknown"]).optional(),
  notes: z.string().max(1000).optional(),
  description: z.string().min(1).max(500).optional(),
});
