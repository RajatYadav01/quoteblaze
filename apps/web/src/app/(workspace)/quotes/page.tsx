import Link from "next/link";
import { listQuotes } from "@/features/quoting/service";
import { requireAuth } from "@/lib/auth/session";

const money = (value: string | number | null | undefined) =>
	value == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));

export default async function QuotesPage() {
	const auth = await requireAuth();
	const rows = await listQuotes(auth.companyId);
	const pending = rows.filter((r) => r.quote.status === "review_required").length;
	const blocked = rows.filter((r) => ["blocked", "site_visit_required"].includes(r.quote.status)).length;
	return (
		<>
			<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-[2.3rem]">Quotes</h1>
					<p className="max-w-175 leading-relaxed text-muted">
						Review drafts, resolve the items holding them back, and record approval. Quoteblaze does not send customer emails.
					</p>
				</div>
				<Link
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
					href="/enquiries"
				>
					+ New enquiry
				</Link>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-4.5">
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">All quotes</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{rows.length}</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Ready for review</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{pending}</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Blocked / site visit</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{blocked}</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Approved</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">
						{rows.filter((r) => r.quote.status === "approved").length}
					</div>
				</div>
			</div>
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
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
									Subtotal
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									VAT
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Total
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted"></th>
							</tr>
						</thead>
						<tbody>
							{rows.map(({ quote, customerName, revision }) => (
								<tr key={quote.id}>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<strong>{quote.quoteNumber}</strong>
										<div className="text-xs text-muted">
											Revision {quote.currentRevision} · {quote.createdAt.toLocaleDateString("en-GB")}
										</div>
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{customerName ?? "Unmatched customer"}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<span
											className={`inline-flex whitespace-nowrap rounded-full bg-[#eef3ef] px-2.5 py-1 text-xs font-bold text-[#40534b] ${quote.status === "approved" ? "bg-[#e0f5e7] text-[#17643f]" : ["blocked", "site_visit_required"].includes(quote.status) ? "bg-[#ffe7e4] text-[#9b3129]" : "bg-[#fff0d6] text-[#855c0a]"}`}
										>
											{quote.status.replaceAll("_", " ")}
										</span>
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{money(revision?.subtotal)}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{money(revision?.vatAmount)}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<strong>{money(revision?.total)}</strong>
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<Link
											className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
											href={`/quotes/${quote.id}`}
										>
											Review
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{rows.length === 0 && (
					<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] mt-2 px-3.5 py-3 text-sm leading-relaxed">
						No quotes yet. Create one from an enquiry to get started.
					</div>
				)}
			</section>
		</>
	);
}
