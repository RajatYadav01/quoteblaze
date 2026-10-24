import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const companies = pgTable("companies", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	currency: text("currency").notNull().default("GBP"),
	vatRate: numeric("vat_rate", { precision: 7, scale: 6 }).notNull().default("0.2"),
	minimumCharge: numeric("minimum_charge", { precision: 12, scale: 2 }).notNull().default("450.00"),
	quoteValidityDays: integer("quote_validity_days").notNull().default(30),
	settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
	createdAt: created(),
	updatedAt: updated(),
});

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: text("email").notNull(),
		fullName: text("full_name").notNull(),
		passwordHash: text("password_hash").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: created(),
		updatedAt: updated(),
	},
	(t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export const memberships = pgTable(
	"memberships",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("reviewer"),
		canApprove: boolean("can_approve").notNull().default(false),
		createdAt: created(),
	},
	(t) => [uniqueIndex("memberships_company_user_uq").on(t.companyId, t.userId), index("memberships_user_idx").on(t.userId)],
);

export const companyAiCredentials = pgTable("company_ai_credentials", {
	id: uuid("id").primaryKey().defaultRandom(),
	companyId: uuid("company_id")
		.notNull()
		.unique()
		.references(() => companies.id, { onDelete: "cascade" }),
	encryptedKey: text("encrypted_key").notNull(),
	model: text("model").notNull().default("openrouter/free"),
	lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
	createdAt: created(),
	updatedAt: updated(),
});

export const customers = pgTable(
	"customers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		businessName: text("business_name"),
		email: text("email"),
		phone: text("phone"),
		address: text("address"),
		notes: text("notes"),
		duplicateGroup: text("duplicate_group"),
		sourceRow: jsonb("source_row").$type<Record<string, unknown>>(),
		createdAt: created(),
		updatedAt: updated(),
	},
	(t) => [
		index("customers_company_idx").on(t.companyId),
		index("customers_email_idx").on(t.companyId, t.email),
		index("customers_phone_idx").on(t.companyId, t.phone),
	],
);

export const customerContacts = pgTable(
	"customer_contacts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => customers.id, { onDelete: "cascade" }),
		name: text("name"),
		email: text("email"),
		phone: text("phone"),
		contactRole: text("contact_role").notNull().default("general"),
		notes: text("notes"),
		createdAt: created(),
	},
	(t) => [index("customer_contacts_company_idx").on(t.companyId, t.customerId)],
);

export const rates = pgTable(
	"rates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		code: text("code").notNull(),
		description: text("description").notNull(),
		unit: text("unit").notNull(),
		rate: numeric("rate", { precision: 12, scale: 2 }),
		status: text("status").notNull().default("needs_review"),
		taxTreatment: text("tax_treatment").notNull().default("unknown"),
		sourceNotes: text("source_notes"),
		reviewNotes: text("review_notes"),
		effectiveFrom: timestamp("effective_from", { withTimezone: true }),
		sourceRow: jsonb("source_row").$type<Record<string, unknown>>(),
		createdAt: created(),
		updatedAt: updated(),
	},
	(t) => [uniqueIndex("rates_company_code_uq").on(t.companyId, t.code), index("rates_company_status_idx").on(t.companyId, t.status)],
);

export const rateImports = pgTable("rate_imports", {
	id: uuid("id").primaryKey().defaultRandom(),
	companyId: uuid("company_id")
		.notNull()
		.references(() => companies.id, { onDelete: "cascade" }),
	fileName: text("file_name").notNull(),
	totalRows: integer("total_rows").notNull().default(0),
	acceptedRows: integer("accepted_rows").notNull().default(0),
	reviewRows: integer("review_rows").notNull().default(0),
	failedRows: integer("failed_rows").notNull().default(0),
	status: text("status").notNull().default("completed"),
	createdBy: uuid("created_by").references(() => users.id),
	createdAt: created(),
});

export const rateImportRows = pgTable(
	"rate_import_rows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		importId: uuid("import_id")
			.notNull()
			.references(() => rateImports.id, { onDelete: "cascade" }),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		rowNumber: integer("row_number").notNull(),
		rawRow: jsonb("raw_row").$type<Record<string, unknown>>().notNull(),
		proposedRateId: uuid("proposed_rate_id").references(() => rates.id),
		status: text("status").notNull(),
		errors: jsonb("errors").$type<string[]>().notNull().default([]),
		createdAt: created(),
	},
	(t) => [index("rate_import_rows_import_idx").on(t.companyId, t.importId)],
);

export const enquiries = pgTable(
	"enquiries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
		subject: text("subject").notNull().default(""),
		rawText: text("raw_text").notNull(),
		senderName: text("sender_name"),
		senderEmail: text("sender_email"),
		siteAddress: text("site_address"),
		analysis: jsonb("analysis").$type<Record<string, unknown>>(),
		quoteability: text("quoteability").notNull().default("needs_information"),
		analysisError: text("analysis_error"),
		createdBy: uuid("created_by").references(() => users.id),
		createdAt: created(),
		updatedAt: updated(),
	},
	(t) => [index("enquiries_company_created_idx").on(t.companyId, t.createdAt)],
);

export const quotes = pgTable(
	"quotes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		enquiryId: uuid("enquiry_id")
			.notNull()
			.references(() => enquiries.id, { onDelete: "cascade" }),
		customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
		quoteNumber: text("quote_number").notNull(),
		status: text("status").notNull().default("draft"),
		currentRevision: integer("current_revision").notNull().default(1),
		createdBy: uuid("created_by").references(() => users.id),
		createdAt: created(),
		updatedAt: updated(),
	},
	(t) => [
		uniqueIndex("quotes_company_number_uq").on(t.companyId, t.quoteNumber),
		uniqueIndex("quotes_company_enquiry_uq").on(t.companyId, t.enquiryId),
		index("quotes_company_status_idx").on(t.companyId, t.status),
	],
);

export const quoteRevisions = pgTable(
	"quote_revisions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		quoteId: uuid("quote_id")
			.notNull()
			.references(() => quotes.id, { onDelete: "cascade" }),
		revision: integer("revision").notNull(),
		items: jsonb("items").$type<Record<string, unknown>[]>().notNull().default([]),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
		vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }),
		total: numeric("total", { precision: 12, scale: 2 }),
		vatRate: numeric("vat_rate", { precision: 7, scale: 6 }).notNull().default("0.2"),
		taxTreatment: text("tax_treatment").notNull().default("exclusive"),
		notes: text("notes"),
		assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
		blockingReasons: jsonb("blocking_reasons").$type<string[]>().notNull().default([]),
		pricingSnapshot: jsonb("pricing_snapshot").$type<Record<string, unknown>>().notNull().default({}),
		createdBy: uuid("created_by").references(() => users.id),
		createdAt: created(),
	},
	(t) => [
		uniqueIndex("quote_revisions_quote_revision_uq").on(t.quoteId, t.revision),
		index("quote_revisions_company_idx").on(t.companyId, t.quoteId),
	],
);

export const approvals = pgTable(
	"approvals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		quoteId: uuid("quote_id")
			.notNull()
			.references(() => quotes.id, { onDelete: "cascade" }),
		revisionId: uuid("revision_id")
			.notNull()
			.references(() => quoteRevisions.id, { onDelete: "restrict" }),
		approvedBy: uuid("approved_by")
			.notNull()
			.references(() => users.id),
		approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
		note: text("note"),
	},
	(t) => [index("approvals_company_quote_idx").on(t.companyId, t.quoteId)],
);

export const auditEvents = pgTable(
	"audit_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		actorUserId: uuid("actor_user_id").references(() => users.id),
		action: text("action").notNull(),
		resourceType: text("resource_type").notNull(),
		resourceId: uuid("resource_id"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
		createdAt: created(),
	},
	(t) => [index("audit_events_company_time_idx").on(t.companyId, t.createdAt)],
);
