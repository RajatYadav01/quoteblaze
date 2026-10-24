"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useState } from "react";

type Analysis = {
	jobType: string;
	summary: string;
	workItems: Array<{
		description: string;
		candidateRateCode: string | null;
		quantity: number | null;
		unit: string | null;
		confidence: number;
		warnings: string[];
	}>;
	missingInformation: string[];
	unsupportedWork: string[];
	siteVisitReasons: string[];
	assumptions: string[];
};
type CustomerOption = { id: string; name: string; businessName: string | null; email: string | null; address: string | null };
type QuoteResult = {
	quote: { id: string; quoteNumber: string; status: string };
	blockers: string[];
	totals: { subtotal: number | null; vat: number | null; total: number | null };
	lineItems: Array<{
		rateCode: string | null;
		description: string;
		quantity: number | null;
		unit: string | null;
		unitRate: number | null;
		lineTotal: number | null;
		blockingReason?: string;
	}>;
};

const money = (n: number | null) =>
	n === null ? "Needs review" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export function EnquiryWorkbench() {
	const [rawText, setRawText] = useState("");
	const [enquiryId, setEnquiryId] = useState("");
	const [savedRawText, setSavedRawText] = useState("");
	const [selectedCustomerId, setSelectedCustomerId] = useState("");
	const [savedCustomerId, setSavedCustomerId] = useState("");
	const [customers, setCustomers] = useState<CustomerOption[]>([]);
	const [analysis, setAnalysis] = useState<Analysis | null>(null);
	const [quote, setQuote] = useState<QuoteResult | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let active = true;
		void fetch("/api/customers")
			.then(async (response) => {
				if (!response.ok) return;
				const result = await response.json();
				if (active && Array.isArray(result.customers)) setCustomers(result.customers as CustomerOption[]);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, []);

	async function createAndAnalyse(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setNotice("");
		setQuote(null);
		setAnalysis(null);
		setLoading(true);
		try {
			let currentEnquiryId = enquiryId;
			const shouldCreateEnquiry = !currentEnquiryId || rawText !== savedRawText || selectedCustomerId !== savedCustomerId;
			if (shouldCreateEnquiry) {
				const create = await fetch("/api/enquiries", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ rawText, customerId: selectedCustomerId || null }),
				});
				const created = await create.json();
				if (!create.ok) throw new Error(created.error ?? "Could not save enquiry.");
				currentEnquiryId = created.enquiry.id;
				setEnquiryId(currentEnquiryId);
				setSavedRawText(rawText);
				setSavedCustomerId(selectedCustomerId);
			}
			const response = await fetch(`/api/enquiries/${currentEnquiryId}/analyse`, { method: "POST" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Analysis failed.");
			setAnalysis(result.analysis);
			setNotice(`Analysis completed using ${result.model}. Review all warnings before creating a quote.`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setLoading(false);
		}
	}

	async function generateQuote() {
		if (!enquiryId) return;
		setError("");
		setLoading(true);
		try {
			const response = await fetch(`/api/enquiries/${enquiryId}/generate-quote`, { method: "POST" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Quote generation failed.");
			setQuote(result);
			setNotice(
				`Quote ${result.quote.quoteNumber} created as ${result.quote.status.replaceAll("_", " ")}. No customer email was sent.`,
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Paste a customer enquiry</h2>
				<p className="leading-relaxed -mt-1.5 text-muted text-xs">
					Keep the full email when possible: sender, subject, measurements, access, and requested timing help with matching and
					review.
				</p>
				<form onSubmit={createAndAnalyse}>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="enquiryText">
							Original email or website enquiry
						</label>
						<textarea
							className="block min-h-45 w-full resize-y rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 leading-relaxed text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="enquiryText"
							required
							minLength={20}
							maxLength={30000}
							value={rawText}
							onChange={(e) => setRawText(e.target.value)}
						/>
					</div>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="existing-customer">
							Match customer (optional)
						</label>
						<select
							className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="existing-customer"
							value={selectedCustomerId}
							onChange={(e) => setSelectedCustomerId(e.target.value)}
						>
							<option value="">Match by sender email when unambiguous</option>
							{customers.map((customer) => (
								<option key={customer.id} value={customer.id}>
									{customer.name}
									{customer.businessName ? ` · ${customer.businessName}` : ""}
									{customer.email ? ` · ${customer.email}` : ""}
								</option>
							))}
						</select>
						<p className="leading-relaxed mt-1.5 text-xs text-muted">
							Uncertain duplicate matches stay separate until a person selects the right customer.
						</p>
					</div>
					{error && (
						<div
							className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23] mb-3"
							role="alert"
						>
							{error}
						</div>
					)}
					{notice && (
						<div
							className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#c6e7cf] bg-[#eaf7ed] text-[#245a39] mb-3"
							role="status"
						>
							{notice}
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<button
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
							disabled={loading || rawText.trim().length < 20}
							type="submit"
						>
							{loading
								? "Analysing…"
								: enquiryId && savedRawText === rawText && savedCustomerId === selectedCustomerId
									? "Retry analysis"
									: "Save and analyse"}
						</button>
						<button
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
							type="button"
							onClick={() => {
								setRawText("");
								setAnalysis(null);
								setQuote(null);
								setEnquiryId("");
								setSavedRawText("");
								setSavedCustomerId("");
								setSelectedCustomerId("");
								setNotice("");
								setError("");
							}}
						>
							Clear
						</button>
					</div>
					<div className="mt-1.5 text-xs leading-relaxed text-muted">
						Customer email content is treated as untrusted input. AI suggestions cannot authorise discounts, override rules, or
						approve a quote.
					</div>
				</form>
			</section>
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<div className="flex flex-col justify-between gap-4 md:flex-row md:items-start mb-4">
					<div>
						<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Analysis and quoteability</h2>
						<p className="leading-relaxed text-xs">
							AI extracts the scope; Quoteblaze validates it against company rules and rates.
						</p>
					</div>
				</div>
				{!analysis && (
					<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed">
						Paste an enquiry and choose <strong>Save and analyse</strong> to see structured work items and warnings.
					</div>
				)}
				{analysis && (
					<div className="grid gap-3">
						<div>
							<span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold bg-[#edf0ef] text-[#4f5c58]">
								{analysis.jobType}
							</span>
							<p className="leading-relaxed">{analysis.summary}</p>
						</div>
						{analysis.workItems.length > 0 && (
							<div className="overflow-x-auto">
								<table className="w-full border-collapse text-sm">
									<thead>
										<tr>
											<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
												Work item
											</th>
											<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
												Rate
											</th>
											<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
												Qty
											</th>
											<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
												Confidence
											</th>
										</tr>
									</thead>
									<tbody>
										{analysis.workItems.map((item) => (
											<tr key={`${item.candidateRateCode ?? "unmatched"}-${item.description}`}>
												<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
													{item.description}
													{item.warnings.length > 0 && (
														<div className="text-xs text-muted">{item.warnings.join("; ")}</div>
													)}
												</td>
												<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
													{item.candidateRateCode ?? "Unmatched"}
												</td>
												<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
													{item.quantity ?? "—"} {item.unit ?? ""}
												</td>
												<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
													{Math.round(item.confidence * 100)}%
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
						{analysis.missingInformation.length > 0 && (
							<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f2deb0] bg-[#fff8e9] text-[#754f09]">
								<strong>Information needed</strong>
								<ul className="list-disc space-y-1 pl-5">
									{analysis.missingInformation.map((v) => (
										<li key={v}>{v}</li>
									))}
								</ul>
							</div>
						)}
						{analysis.siteVisitReasons.length > 0 && (
							<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]">
								<strong>Site visit required</strong>
								<ul className="list-disc space-y-1 pl-5">
									{analysis.siteVisitReasons.map((v) => (
										<li key={v}>{v}</li>
									))}
								</ul>
							</div>
						)}
						{analysis.unsupportedWork.length > 0 && (
							<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]">
								<strong>Unsupported work</strong>
								<ul className="list-disc space-y-1 pl-5">
									{analysis.unsupportedWork.map((v) => (
										<li key={v}>{v}</li>
									))}
								</ul>
							</div>
						)}
						{analysis.assumptions.length > 0 && (
							<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed">
								<strong>Assumptions</strong>
								<ul className="list-disc space-y-1 pl-5">
									{analysis.assumptions.map((v) => (
										<li key={v}>{v}</li>
									))}
								</ul>
							</div>
						)}
						<button
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
							type="button"
							disabled={loading || !enquiryId || Boolean(quote)}
							onClick={generateQuote}
						>
							{loading ? "Generating…" : quote ? "Draft already created" : "Generate quote draft"}
						</button>
					</div>
				)}
				{quote && (
					<div className="grid gap-3 mt-5 border-t border-line pt-5">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="text-base font-semibold tracking-tight m-0">{quote.quote.quoteNumber}</h3>
							<span
								className={`inline-flex whitespace-nowrap rounded-full bg-[#eef3ef] px-2.5 py-1 text-xs font-bold text-[#40534b] ${quote.quote.status === "review_required" ? "bg-[#fff0d6] text-[#855c0a]" : "bg-[#ffe7e4] text-[#9b3129]"}`}
							>
								{quote.quote.status.replaceAll("_", " ")}
							</span>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								<thead>
									<tr>
										<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
											Rate / scope
										</th>
										<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
											Amount
										</th>
									</tr>
								</thead>
								<tbody>
									{quote.lineItems.map((line) => (
										<tr key={`${line.rateCode ?? "unmatched"}-${line.description}`}>
											<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
												<strong>{line.rateCode ?? "Unpriced"}</strong> — {line.description}
												<div className="text-xs text-muted">
													{line.quantity ?? "?"} {line.unit ?? ""} × {money(line.unitRate)}
												</div>
												{line.blockingReason && <div className="text-xs text-[#a13226]">{line.blockingReason}</div>}
											</td>
											<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
												{money(line.lineTotal)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed">
							<div className="flex justify-between">
								<span>Subtotal (ex VAT)</span>
								<strong>{money(quote.totals.subtotal)}</strong>
							</div>
							<div className="flex justify-between mt-1.25">
								<span>VAT</span>
								<strong>{money(quote.totals.vat)}</strong>
							</div>
							<hr className="my-4.5 border-0 border-t border-line" />
							<div className="flex justify-between text-lg">
								<strong>Total</strong>
								<strong>{money(quote.totals.total)}</strong>
							</div>
						</div>
						{quote.blockers.length > 0 && (
							<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]">
								<strong>Approval blocked</strong>
								<ul className="list-disc space-y-1 pl-5">
									{quote.blockers.map((v) => (
										<li key={v}>{v}</li>
									))}
								</ul>
							</div>
						)}
						<Link
							href={`/quotes/${quote.quote.id}`}
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
						>
							Open quote review
						</Link>
					</div>
				)}
			</section>
		</div>
	);
}
