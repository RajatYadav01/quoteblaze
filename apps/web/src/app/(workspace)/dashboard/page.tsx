import { and, count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

function money(value: string | number | null | undefined) {
	return value == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));
}

export default async function DashboardPage() {
	const auth = await getAuthContext();
	if (!auth) return null;
	const [customersCount, ratesCount, enquiryCount, quoteCount, recentQuotes] = await Promise.all([
		db.select({ count: count() }).from(schema.customers).where(eq(schema.customers.companyId, auth.companyId)),
		db.select({ count: count() }).from(schema.rates).where(eq(schema.rates.companyId, auth.companyId)),
		db.select({ count: count() }).from(schema.enquiries).where(eq(schema.enquiries.companyId, auth.companyId)),
		db.select({ count: count() }).from(schema.quotes).where(eq(schema.quotes.companyId, auth.companyId)),
		db
			.select({ quote: schema.quotes, customerName: schema.customers.name, revision: schema.quoteRevisions })
			.from(schema.quotes)
			.leftJoin(
				schema.customers,
				and(eq(schema.customers.id, schema.quotes.customerId), eq(schema.customers.companyId, auth.companyId)),
			)
			.leftJoin(
				schema.quoteRevisions,
				and(
					eq(schema.quoteRevisions.quoteId, schema.quotes.id),
					eq(schema.quoteRevisions.revision, schema.quotes.currentRevision),
					eq(schema.quoteRevisions.companyId, auth.companyId),
				),
			)
			.where(eq(schema.quotes.companyId, auth.companyId))
			.orderBy(desc(schema.quotes.createdAt))
			.limit(5),
	]);
	return (
		<>
			<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-[2.3rem]">Good work starts with a good quote.</h1>
					<p className="max-w-175 leading-relaxed text-muted">
						Welcome back, {auth.fullName.split(" ")[0]}. Review incoming work, keep pricing tidy, and approve every quote before
						it leaves the business.
					</p>
				</div>
				<Link
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
					href="/enquiries"
				>
					+ New enquiry
				</Link>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 min-[1100px]:grid-cols-4 mb-5 gap-4">
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Customers</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{customersCount[0]?.count ?? 0}</div>
					<div className="mt-1 text-xs text-muted">Company contacts and repeat work</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Rate catalogue</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{ratesCount[0]?.count ?? 0}</div>
					<div className="mt-1 text-xs text-muted">Review flagged prices before use</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Enquiries captured</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{enquiryCount[0]?.count ?? 0}</div>
					<div className="mt-1 text-xs text-muted">Original customer messages retained</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Quotes created</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{quoteCount[0]?.count ?? 0}</div>
					<div className="mt-1 text-xs text-muted">Approval is always human-led</div>
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="mb-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
						<div>
							<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Recent quotes</h2>
							<p className="leading-relaxed text-xs text-muted">Drafts, blocked work, and approved revisions.</p>
						</div>
						<Link className="text-xs" href="/quotes">
							View all →
						</Link>
					</div>
					{recentQuotes.length ? (
						<div className="overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								<thead>
									<tr>
										<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
											Quote
										</th>
										<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
											Customer
										</th>
										<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
											Status
										</th>
										<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
											Total
										</th>
									</tr>
								</thead>
								<tbody>
									{recentQuotes.map(({ quote, customerName, revision }) => (
										<tr key={`${quote.id}-${revision?.id}`}>
											<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
												<Link href={`/quotes/${quote.id}`}>
													<strong>{quote.quoteNumber}</strong>
												</Link>
												<div className="text-xs text-muted">{quote.createdAt.toLocaleDateString("en-GB")}</div>
											</td>
											<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
												{customerName ?? "Unmatched"}
											</td>
											<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
												<span
													className={`inline-flex whitespace-nowrap rounded-full bg-[#eef3ef] px-2.5 py-1 text-xs font-bold text-[#40534b] ${quote.status === "approved" ? "bg-[#e0f5e7] text-[#17643f]" : quote.status === "blocked" || quote.status === "site_visit_required" ? "bg-[#ffe7e4] text-[#9b3129]" : "bg-[#fff0d6] text-[#855c0a]"}`}
												>
													{quote.status.replaceAll("_", " ")}
												</span>
											</td>
											<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
												{money(revision?.total)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed">
							No quotes yet. Start with a customer enquiry and let Quoteblaze prepare a draft.
						</div>
					)}
				</section>
				<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<h2 className="mb-3.5 text-lg font-semibold tracking-tight">A safe quoting workflow</h2>
					<div className="grid gap-3">
						<div className="flex gap-3">
							<span className="grid size-8.5 shrink-0 place-items-center rounded-[11px] bg-[#a9e3bb] font-black text-[#143f31]">
								1
							</span>
							<div>
								<strong>Capture the enquiry</strong>
								<div className="text-xs text-muted">
									Paste the customer's original email. Quoteblaze keeps it as the source record.
								</div>
							</div>
						</div>
						<div className="flex gap-3">
							<span className="grid size-8.5 shrink-0 place-items-center rounded-[11px] bg-[#a9e3bb] font-black text-[#143f31]">
								2
							</span>
							<div>
								<strong>Check the analysis</strong>
								<div className="text-xs text-muted">
									Review the job scope, quantities, assumptions, and price-list warnings.
								</div>
							</div>
						</div>
						<div className="flex gap-3">
							<span className="grid size-8.5 shrink-0 place-items-center rounded-[11px] bg-[#a9e3bb] font-black text-[#143f31]">
								3
							</span>
							<div>
								<strong>Approve the revision</strong>
								<div className="text-xs text-muted">
									A person signs off. Quoteblaze never emails customers automatically.
								</div>
							</div>
						</div>
					</div>
					<hr className="my-4.5 border-0 border-t border-line" />
					<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f2deb0] bg-[#fff8e9] text-[#754f09]">
						<strong>Before quoting:</strong> check the rate catalogue for entries marked “needs review” or “inactive”. Imported
						prices are not silently trusted.
					</div>
					<div className="flex flex-wrap items-center gap-2 mt-3.5">
						<Link
							href="/rates"
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
						>
							Review rates
						</Link>
						<Link
							href="/settings"
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
						>
							Configure AI
						</Link>
					</div>
				</section>
			</div>
		</>
	);
}
