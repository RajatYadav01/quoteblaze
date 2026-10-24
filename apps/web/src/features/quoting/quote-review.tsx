"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = {
	rateId?: string;
	rateCode: string | null;
	description: string;
	quantity: number | null;
	unit: string | null;
	unitRate: number | null;
	taxTreatment?: string;
	lineTotal: number | null;
	blockingReason?: string;
	sourceEvidence?: string;
	humanEdited?: boolean;
	excluded?: boolean;
	exclusionNote?: string | null;
	manualUnitRate?: number;
	manualRateOverride?: boolean;
	overrideReason?: string | null;
};
type Quote = { id: string; quoteNumber: string; status: string; currentRevision: number };
type Revision = {
	id: string;
	revision: number;
	items: Record<string, unknown>[];
	subtotal: string | null;
	vatAmount: string | null;
	total: string | null;
	notes: string | null;
	assumptions: string[];
	blockingReasons: string[];
	pricingSnapshot?: Record<string, unknown>;
};
const money = (value: number | string | null | undefined) =>
	value == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));

export function QuoteReview({
	quote: initialQuote,
	revision: initialRevision,
	customerName,
	customerEmail,
	canApprove,
	resolvableBlockers,
}: {
	quote: Quote;
	revision: Revision;
	customerName: string | null;
	customerEmail: string | null;
	canApprove: boolean;
	resolvableBlockers: string[];
}) {
	const router = useRouter();
	const [quote, setQuote] = useState(initialQuote);
	const [revision, setRevision] = useState(initialRevision);
	const [items, setItems] = useState<Item[]>(initialRevision.items as unknown as Item[]);
	const [notes, setNotes] = useState(initialRevision.notes ?? "");
	const [assumptions, setAssumptions] = useState((initialRevision.assumptions ?? []).join("\n"));
	const [overrideReason, setOverrideReason] = useState("");
	const [resolvedBlockingReasons, setResolvedBlockingReasons] = useState<string[]>([]);
	const [resolutionNote, setResolutionNote] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	function patchItem(index: number, key: "quantity" | "rateCode" | "description" | "unit", value: string) {
		setItems((old) =>
			old.map((item, i) => {
				if (i !== index) return item;
				if (key === "quantity") return { ...item, quantity: value === "" ? null : Number(value) };
				if (key === "rateCode") return { ...item, rateCode: value.trim() ? value.trim() : null };
				if (key === "description") return { ...item, description: value };
				return { ...item, unit: value.trim() ? value.trim() : null };
			}),
		);
	}
	async function save() {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch(`/api/quotes/${quote.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					notes,
					assumptions: assumptions
						.split("\n")
						.map((x) => x.trim())
						.filter(Boolean),
					overrideReason: overrideReason.trim() || undefined,
					lineItems: items.map((item) => ({
						id: item.rateId,
						rateCode: item.rateCode,
						description: item.description,
						quantity: item.quantity,
						unit: item.unit,
						excluded: Boolean(item.excluded),
						manualUnitRate: item.manualUnitRate ?? (item.manualRateOverride ? (item.unitRate ?? undefined) : undefined),
					})),
					resolvedBlockingReasons,
					resolutionNote: resolvedBlockingReasons.length || items.some((item) => item.excluded) ? resolutionNote : undefined,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Could not save changes.");
			setQuote(result.quote);
			setRevision(result.revision);
			setItems(result.revision.items as Item[]);
			setMessage("New revision saved. Any prior approval applies only to its original revision.");
			setOverrideReason("");
			setResolvedBlockingReasons([]);
			setResolutionNote("");
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setBusy(false);
		}
	}
	async function approve() {
		if (
			!window.confirm(
				`Approve ${quote.quoteNumber} revision ${quote.currentRevision}? This records internal approval; it does not send an email.`,
			)
		)
			return;
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch(`/api/quotes/${quote.id}/approve`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ note: "Approved in Quoteblaze review screen." }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Approval failed.");
			setQuote(result.quote);
			setMessage(result.message);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setBusy(false);
		}
	}

	const totals = { subtotal: revision.subtotal, vat: revision.vatAmount, total: revision.total };
	const isBlocked = ["blocked", "site_visit_required"].includes(quote.status) || (revision.blockingReasons?.length ?? 0) > 0;
	return (
		<div className="grid gap-3">
			<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={`inline-flex whitespace-nowrap rounded-full bg-[#eef3ef] px-2.5 py-1 text-xs font-bold text-[#40534b] ${quote.status === "approved" ? "bg-[#e0f5e7] text-[#17643f]" : isBlocked ? "bg-[#ffe7e4] text-[#9b3129]" : "bg-[#fff0d6] text-[#855c0a]"}`}
						>
							{quote.status.replaceAll("_", " ")}
						</span>
						<span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold bg-[#edf0ef] text-[#4f5c58]">
							Revision {revision.revision}
						</span>
					</div>
					<h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-[2.3rem] mt-2.5">{quote.quoteNumber}</h1>
					<p className="max-w-175 leading-relaxed text-muted">
						{customerName ?? "Unmatched customer"}
						{customerEmail ? ` · ${customerEmail}` : ""}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
						type="button"
						onClick={() => router.push("/quotes")}
					>
						Back to quotes
					</button>
					{canApprove && quote.status === "review_required" && (
						<button
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
							disabled={busy || isBlocked}
							type="button"
							onClick={approve}
						>
							Approve revision
						</button>
					)}
				</div>
			</div>
			{message && (
				<div
					className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#c6e7cf] bg-[#eaf7ed] text-[#245a39]"
					role="status"
				>
					{message}
				</div>
			)}
			{error && (
				<div
					className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]"
					role="alert"
				>
					{error}
				</div>
			)}
			{quote.status === "approved" && (
				<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#c6e7cf] bg-[#eaf7ed] text-[#245a39]">
					<strong>Approved internally.</strong> No email was sent. A future edit must create a new revision and requires new
					approval.
				</div>
			)}
			{quote.status === "site_visit_required" && (
				<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]">
					<strong>Site visit required.</strong> This enquiry cannot be turned into a priced quote from email alone.
				</div>
			)}
			{revision.blockingReasons?.length > 0 && (
				<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]">
					<strong>Issues to resolve before approval</strong>
					<ul className="list-disc space-y-1 pl-5">
						{revision.blockingReasons.map((b) => (
							<li key={b}>{b}</li>
						))}
					</ul>
				</div>
			)}
			{(resolvableBlockers.filter((reason) => revision.blockingReasons.includes(reason)).length > 0 ||
				items.some((item) => item.excluded)) &&
				quote.status !== "site_visit_required" && (
					<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
						<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Human resolution of information requests</h2>
						<p className="leading-relaxed text-xs text-muted">
							Only information requests can be resolved here, and only after you have actually checked the details.
							Unsupported work and site-visit requirements cannot be bypassed.
						</p>
						<div className="grid gap-3">
							{resolvableBlockers
								.filter((reason) => revision.blockingReasons.includes(reason))
								.map((reason) => (
									<label className="flex gap-2.5" key={reason}>
										<input
											type="checkbox"
											checked={resolvedBlockingReasons.includes(reason)}
											onChange={(event) =>
												setResolvedBlockingReasons((old) =>
													event.target.checked ? [...old, reason] : old.filter((x) => x !== reason),
												)
											}
										/>
										<span>{reason}</span>
									</label>
								))}
						</div>
						{(resolvedBlockingReasons.length > 0 || items.some((item) => item.excluded)) && (
							<div className="mb-4 mt-4">
								<label className="mb-1.5 block text-sm font-semibold" htmlFor="resolution-note">
									Explain what was confirmed or explicitly excluded *
								</label>
								<textarea
									className="block w-full resize-y rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 leading-relaxed text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-h-22.5"
									id="resolution-note"
									minLength={10}
									value={resolutionNote}
									onChange={(event) => setResolutionNote(event.target.value)}
									placeholder="E.g. customer confirmed a road permit is not required; or this item is excluded from the quoted scope."
								/>
							</div>
						)}
					</section>
				)}
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Itemised scope and pricing</h2>
				<p className="leading-relaxed text-xs text-muted">
					Change quantity, unit, selected rate, description, or unit price if confirmed by a human. Rate-code changes must use an
					active company rate; manual unit-rate overrides require an audit reason. Totals are recalculated on the server.
				</p>
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Exclude
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Rate code
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Work item
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Quantity
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Unit
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Unit rate
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Line total
								</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item, index) => (
								<tr className={item.excluded ? "opacity-60" : ""} key={`${item.rateCode ?? "unpriced"}-${index}`}>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<label>
											<input
												type="checkbox"
												aria-label={`Exclude ${index + 1} from quote`}
												checked={Boolean(item.excluded)}
												onChange={(e) =>
													setItems((old) =>
														old.map((row, i) => (i === index ? { ...row, excluded: e.target.checked } : row)),
													)
												}
											/>{" "}
											<span className="text-xs">Exclude</span>
										</label>
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<input
											className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-22.5"
											aria-label={`Rate code ${index + 1}`}
											disabled={Boolean(item.excluded)}
											value={item.rateCode ?? ""}
											onChange={(e) => patchItem(index, "rateCode", e.target.value)}
											placeholder="Rate code"
										/>
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<input
											className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-47.5"
											aria-label={`Description ${index + 1}`}
											disabled={Boolean(item.excluded)}
											value={item.description}
											onChange={(e) => patchItem(index, "description", e.target.value)}
										/>
										{item.taxTreatment && (
											<div className="text-xs text-muted">
												{item.taxTreatment === "inclusive"
													? "Source rate includes VAT"
													: item.taxTreatment === "exclusive"
														? "Source rate excludes VAT"
														: "VAT treatment unresolved"}
											</div>
										)}
										{item.blockingReason && <div className="text-xs text-[#9b3129] mt-1.25">{item.blockingReason}</div>}
										{item.excluded && (
											<div className="text-xs text-muted">
												Excluded from priced scope; this decision will be recorded in assumptions.
											</div>
										)}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<input
											className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-[90px]"
											type="number"
											min="0.001"
											step="0.001"
											aria-label={`Quantity ${index + 1}`}
											disabled={Boolean(item.excluded)}
											value={item.quantity ?? ""}
											onChange={(e) => patchItem(index, "quantity", e.target.value)}
										/>
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<input
											className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-21.25"
											aria-label={`Unit ${index + 1}`}
											disabled={Boolean(item.excluded)}
											value={item.unit ?? ""}
											onChange={(e) => patchItem(index, "unit", e.target.value)}
										/>
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{item.excluded ? (
											"Excluded"
										) : (
											<input
												className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-26.25"
												type="number"
												min="0"
												step="0.01"
												aria-label={`Unit rate ${index + 1}`}
												disabled={Boolean(item.excluded)}
												value={item.manualUnitRate ?? item.unitRate ?? ""}
												onChange={(e) =>
													setItems((old) =>
														old.map((row, i) =>
															i === index
																? {
																		...row,
																		manualUnitRate:
																			e.target.value === "" ? undefined : Number(e.target.value),
																	}
																: row,
														),
													)
												}
											/>
										)}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{item.excluded ? "—" : money(item.manualUnitRate ?? item.unitRate)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 mt-5">
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="quote-notes">
							Quote summary / notes
						</label>
						<textarea
							id="quote-notes"
							className="block w-full resize-y rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 leading-relaxed text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-h-25"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="quote-assumptions">
							Assumptions and exclusions (one per line)
						</label>
						<textarea
							id="quote-assumptions"
							className="block w-full resize-y rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 leading-relaxed text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-h-25"
							value={assumptions}
							onChange={(e) => setAssumptions(e.target.value)}
						/>
					</div>
				</div>
				<div className="mb-4">
					<label className="mb-1.5 block text-sm font-semibold" htmlFor="override-reason">
						Reason for manual change (if applicable)
					</label>
					<input
						className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
						id="override-reason"
						value={overrideReason}
						onChange={(e) => setOverrideReason(e.target.value)}
						placeholder="Why was the rate / quantity changed?"
					/>
				</div>
				<button
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
					type="button"
					onClick={save}
					disabled={busy || quote.status === "site_visit_required"}
				>
					{busy ? "Saving…" : "Save as new revision"}
				</button>
			</section>
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)] max-w-137.5 w-full">
				<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Quote totals</h2>
				<div className="grid gap-3">
					{revision.pricingSnapshot?.minimumChargeApplied === true && (
						<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed">
							Minimum job charge applied: subtotal raised to the configured minimum of{" "}
							{money(Number(revision.pricingSnapshot.minimumCharge))} ex VAT. This is a pricing adjustment, not a separate
							line item.
						</div>
					)}
					<div className="flex justify-between">
						<span className="text-muted">Subtotal (ex VAT)</span>
						<strong>{money(totals.subtotal)}</strong>
					</div>
					<div className="flex justify-between">
						<span className="text-muted">VAT</span>
						<strong>{money(totals.vat)}</strong>
					</div>
					<hr className="my-1 border-0 border-t border-line" />
					<div className="flex justify-between text-xl">
						<strong>Total</strong>
						<strong>{money(totals.total)}</strong>
					</div>
					<p className="leading-relaxed mt-1.5 text-xs text-muted">
						Review the rate provenance, VAT treatment and blocking warnings before approval.
					</p>
				</div>
			</section>
		</div>
	);
}
