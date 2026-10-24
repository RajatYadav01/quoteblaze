CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"approved_by" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"vat_rate" numeric(7,6) DEFAULT '0.2' NOT NULL,
	"minimum_charge" numeric(12,2) DEFAULT '450.00' NOT NULL,
	"quote_validity_days" integer DEFAULT 30 NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_ai_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL UNIQUE,
	"encrypted_key" text NOT NULL,
	"model" text DEFAULT 'openrouter/free' NOT NULL,
	"last_tested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"contact_role" text DEFAULT 'general' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"business_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text,
	"duplicate_group" text,
	"source_row" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"customer_id" uuid,
	"subject" text DEFAULT '' NOT NULL,
	"raw_text" text NOT NULL,
	"sender_name" text,
	"sender_email" text,
	"site_address" text,
	"analysis" jsonb,
	"quoteability" text DEFAULT 'needs_information' NOT NULL,
	"analysis_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'reviewer' NOT NULL,
	"can_approve" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"subtotal" numeric(12,2),
	"vat_amount" numeric(12,2),
	"total" numeric(12,2),
	"vat_rate" numeric(7,6) DEFAULT '0.2' NOT NULL,
	"tax_treatment" text DEFAULT 'exclusive' NOT NULL,
	"notes" text,
	"assumptions" jsonb DEFAULT '[]' NOT NULL,
	"blocking_reasons" jsonb DEFAULT '[]' NOT NULL,
	"pricing_snapshot" jsonb DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"customer_id" uuid,
	"quote_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"import_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_row" jsonb NOT NULL,
	"proposed_rate_id" uuid,
	"status" text NOT NULL,
	"errors" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"accepted_rows" integer DEFAULT 0 NOT NULL,
	"review_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"rate" numeric(12,2),
	"status" text DEFAULT 'needs_review' NOT NULL,
	"tax_treatment" text DEFAULT 'unknown' NOT NULL,
	"source_notes" text,
	"review_notes" text,
	"effective_from" timestamp with time zone,
	"source_row" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "approvals_company_quote_idx" ON "approvals" ("company_id","quote_id");--> statement-breakpoint
CREATE INDEX "audit_events_company_time_idx" ON "audit_events" ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_contacts_company_idx" ON "customer_contacts" ("company_id","customer_id");--> statement-breakpoint
CREATE INDEX "customers_company_idx" ON "customers" ("company_id");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" ("company_id","email");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" ("company_id","phone");--> statement-breakpoint
CREATE INDEX "enquiries_company_created_idx" ON "enquiries" ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_company_user_uq" ON "memberships" ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_revisions_quote_revision_uq" ON "quote_revisions" ("quote_id","revision");--> statement-breakpoint
CREATE INDEX "quote_revisions_company_idx" ON "quote_revisions" ("company_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_company_number_uq" ON "quotes" ("company_id","quote_number");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_company_enquiry_uq" ON "quotes" ("company_id","enquiry_id");--> statement-breakpoint
CREATE INDEX "quotes_company_status_idx" ON "quotes" ("company_id","status");--> statement-breakpoint
CREATE INDEX "rate_import_rows_import_idx" ON "rate_import_rows" ("company_id","import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rates_company_code_uq" ON "rates" ("company_id","code");--> statement-breakpoint
CREATE INDEX "rates_company_status_idx" ON "rates" ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" (lower("email"));--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_revision_id_quote_revisions_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "quote_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_users_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "company_ai_credentials" ADD CONSTRAINT "company_ai_credentials_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_enquiry_id_enquiries_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "rate_import_rows" ADD CONSTRAINT "rate_import_rows_import_id_rate_imports_id_fkey" FOREIGN KEY ("import_id") REFERENCES "rate_imports"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rate_import_rows" ADD CONSTRAINT "rate_import_rows_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rate_import_rows" ADD CONSTRAINT "rate_import_rows_proposed_rate_id_rates_id_fkey" FOREIGN KEY ("proposed_rate_id") REFERENCES "rates"("id");--> statement-breakpoint
ALTER TABLE "rate_imports" ADD CONSTRAINT "rate_imports_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rate_imports" ADD CONSTRAINT "rate_imports_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;