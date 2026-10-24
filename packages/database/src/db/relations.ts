import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.ts";

/**
 * Drizzle relational-query metadata lives separately from table definitions.
 * These are application-level relations; the actual foreign-key constraints
 * remain defined in schema.ts and the SQL migration.
 */
export const relations = defineRelations(schema, (r) => ({
	companies: {
		memberships: r.many.memberships({ from: r.companies.id, to: r.memberships.companyId }),
		users: r.many.users({
			from: r.companies.id.through(r.memberships.companyId),
			to: r.users.id.through(r.memberships.userId),
		}),
		aiCredentials: r.one.companyAiCredentials({
			from: r.companies.id,
			to: r.companyAiCredentials.companyId,
			optional: true,
		}),
		customers: r.many.customers({ from: r.companies.id, to: r.customers.companyId }),
		contacts: r.many.customerContacts({ from: r.companies.id, to: r.customerContacts.companyId }),
		rates: r.many.rates({ from: r.companies.id, to: r.rates.companyId }),
		rateImports: r.many.rateImports({ from: r.companies.id, to: r.rateImports.companyId }),
		rateImportRows: r.many.rateImportRows({ from: r.companies.id, to: r.rateImportRows.companyId }),
		enquiries: r.many.enquiries({ from: r.companies.id, to: r.enquiries.companyId }),
		quotes: r.many.quotes({ from: r.companies.id, to: r.quotes.companyId }),
		quoteRevisions: r.many.quoteRevisions({
			from: r.companies.id,
			to: r.quoteRevisions.companyId,
		}),
		approvals: r.many.approvals({ from: r.companies.id, to: r.approvals.companyId }),
		auditEvents: r.many.auditEvents({ from: r.companies.id, to: r.auditEvents.companyId }),
	},
	users: {
		memberships: r.many.memberships({ from: r.users.id, to: r.memberships.userId }),
		companies: r.many.companies({
			from: r.users.id.through(r.memberships.userId),
			to: r.companies.id.through(r.memberships.companyId),
		}),
		createdRateImports: r.many.rateImports({ from: r.users.id, to: r.rateImports.createdBy }),
		createdEnquiries: r.many.enquiries({ from: r.users.id, to: r.enquiries.createdBy }),
		createdQuotes: r.many.quotes({ from: r.users.id, to: r.quotes.createdBy }),
		createdQuoteRevisions: r.many.quoteRevisions({
			from: r.users.id,
			to: r.quoteRevisions.createdBy,
		}),
		approvedQuotes: r.many.approvals({ from: r.users.id, to: r.approvals.approvedBy }),
		auditEvents: r.many.auditEvents({ from: r.users.id, to: r.auditEvents.actorUserId }),
	},
	memberships: {
		company: r.one.companies({
			from: r.memberships.companyId,
			to: r.companies.id,
			optional: false,
		}),
		user: r.one.users({ from: r.memberships.userId, to: r.users.id, optional: false }),
	},
	companyAiCredentials: {
		company: r.one.companies({
			from: r.companyAiCredentials.companyId,
			to: r.companies.id,
			optional: false,
		}),
	},
	customers: {
		company: r.one.companies({ from: r.customers.companyId, to: r.companies.id, optional: false }),
		contacts: r.many.customerContacts({ from: r.customers.id, to: r.customerContacts.customerId }),
		enquiries: r.many.enquiries({ from: r.customers.id, to: r.enquiries.customerId }),
		quotes: r.many.quotes({ from: r.customers.id, to: r.quotes.customerId }),
	},
	customerContacts: {
		company: r.one.companies({
			from: r.customerContacts.companyId,
			to: r.companies.id,
			optional: false,
		}),
		customer: r.one.customers({
			from: r.customerContacts.customerId,
			to: r.customers.id,
			optional: false,
		}),
	},
	rates: {
		company: r.one.companies({ from: r.rates.companyId, to: r.companies.id, optional: false }),
		importRows: r.many.rateImportRows({ from: r.rates.id, to: r.rateImportRows.proposedRateId }),
	},
	rateImports: {
		company: r.one.companies({ from: r.rateImports.companyId, to: r.companies.id, optional: false }),
		createdByUser: r.one.users({
			from: r.rateImports.createdBy,
			to: r.users.id,
			optional: true,
		}),
		rows: r.many.rateImportRows({ from: r.rateImports.id, to: r.rateImportRows.importId }),
	},
	rateImportRows: {
		company: r.one.companies({
			from: r.rateImportRows.companyId,
			to: r.companies.id,
			optional: false,
		}),
		rateImport: r.one.rateImports({
			from: r.rateImportRows.importId,
			to: r.rateImports.id,
			optional: false,
		}),
		proposedRate: r.one.rates({
			from: r.rateImportRows.proposedRateId,
			to: r.rates.id,
			optional: true,
		}),
	},
	enquiries: {
		company: r.one.companies({ from: r.enquiries.companyId, to: r.companies.id, optional: false }),
		customer: r.one.customers({ from: r.enquiries.customerId, to: r.customers.id, optional: true }),
		createdByUser: r.one.users({
			from: r.enquiries.createdBy,
			to: r.users.id,
			optional: true,
		}),
		quotes: r.many.quotes({ from: r.enquiries.id, to: r.quotes.enquiryId }),
	},
	quotes: {
		company: r.one.companies({ from: r.quotes.companyId, to: r.companies.id, optional: false }),
		enquiry: r.one.enquiries({ from: r.quotes.enquiryId, to: r.enquiries.id, optional: false }),
		customer: r.one.customers({ from: r.quotes.customerId, to: r.customers.id, optional: true }),
		createdByUser: r.one.users({
			from: r.quotes.createdBy,
			to: r.users.id,
			optional: true,
		}),
		revisions: r.many.quoteRevisions({ from: r.quotes.id, to: r.quoteRevisions.quoteId }),
		approvals: r.many.approvals({ from: r.quotes.id, to: r.approvals.quoteId }),
	},
	quoteRevisions: {
		company: r.one.companies({
			from: r.quoteRevisions.companyId,
			to: r.companies.id,
			optional: false,
		}),
		quote: r.one.quotes({ from: r.quoteRevisions.quoteId, to: r.quotes.id, optional: false }),
		createdByUser: r.one.users({
			from: r.quoteRevisions.createdBy,
			to: r.users.id,
			optional: true,
		}),
		approvals: r.many.approvals({ from: r.quoteRevisions.id, to: r.approvals.revisionId }),
	},
	approvals: {
		company: r.one.companies({ from: r.approvals.companyId, to: r.companies.id, optional: false }),
		quote: r.one.quotes({ from: r.approvals.quoteId, to: r.quotes.id, optional: false }),
		revision: r.one.quoteRevisions({
			from: r.approvals.revisionId,
			to: r.quoteRevisions.id,
			optional: false,
		}),
		approver: r.one.users({ from: r.approvals.approvedBy, to: r.users.id, optional: false }),
	},
	auditEvents: {
		company: r.one.companies({ from: r.auditEvents.companyId, to: r.companies.id, optional: false }),
		actor: r.one.users({ from: r.auditEvents.actorUserId, to: r.users.id, optional: true }),
	},
}));
