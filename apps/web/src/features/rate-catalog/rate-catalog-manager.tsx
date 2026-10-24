"use client";

import { type ChangeEvent, useState } from "react";

type Rate = {
	id: string;
	code: string;
	description: string;
	unit: string;
	rate: string | null;
	status: string;
	taxTreatment: string;
	sourceNotes: string | null;
	reviewNotes: string | null;
};

const _money = (n: string | null) =>
	n === null ? "TBC" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n));

export function RateCatalogManager({ initialRates }: { initialRates: Rate[] }) {
	const [rates, setRates] = useState(initialRates);
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState("all");
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const filtered = rates.filter(
		(rate) =>
			`${rate.code} ${rate.description} ${rate.unit} ${rate.sourceNotes ?? ""}`.toLowerCase().includes(query.toLowerCase()) &&
			(status === "all" || rate.status === status),
	);
	async function upload(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		setError("");
		setMessage("");
		setUploading(true);
		try {
			const form = new FormData();
			form.set("file", file);
			const response = await fetch("/api/rates/import", { method: "POST", body: form });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Import failed.");
			setMessage(
				`Imported ${result.report.total} rows: ${result.report.accepted} accepted, ${result.report.review} needing review, ${result.report.failed} failed. Existing reviewed rates were not overwritten.`,
			);
			const ratesResponse = await fetch("/api/rates");
			const ratesResult = await ratesResponse.json();
			if (ratesResponse.ok) setRates(ratesResult.rates);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setUploading(false);
			event.target.value = "";
		}
	}
	async function saveRate(rate: Rate, nextStatus: string, taxTreatment: string, rateValue: string) {
		setError("");
		setMessage("");
		const response = await fetch(`/api/rates/${rate.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: nextStatus, taxTreatment, rate: rateValue.trim() === "" ? null : Number(rateValue) }),
		});
		const result = await response.json();
		if (!response.ok) {
			setError(result.error ?? "Could not update rate.");
			return;
		}
		setRates((old) => old.map((item) => (item.id === rate.id ? result.rate : item)));
		setMessage(`${rate.code} updated. Confirm the source evidence before making a rate active.`);
	}
	return (
		<div className="grid gap-3">
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<div className="grid grid-cols-1 md:grid-cols-2">
					<div>
						<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Import a CSV</h2>
						<p className="leading-relaxed text-muted text-xs">
							Import preserves the source row. Suspicious notes, TBC rates, and existing codes are not silently trusted or
							overwritten.
						</p>
						<label
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
							htmlFor="rates-csv"
						>
							{uploading ? "Importing…" : "Choose CSV file"}
						</label>
						<input
							className="hidden"
							id="rates-csv"
							type="file"
							accept=".csv,text/csv"
							disabled={uploading}
							onChange={upload}
						/>
					</div>
					<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed">
						<strong>Review before use</strong>
						<div className="text-xs mt-1.25">
							Examples include old prices, duplicate materials, unclear VAT treatment, and rates marked TBC. Only active rates
							with resolved tax treatment can price a quote.
						</div>
					</div>
				</div>
				{message && (
					<div
						className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#c6e7cf] bg-[#eaf7ed] text-[#245a39] mt-3.5"
						role="status"
					>
						{message}
					</div>
				)}
				{error && (
					<div
						className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23] mt-3.5"
						role="alert"
					>
						{error}
					</div>
				)}
			</section>
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
					<input
						className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 max-w-95"
						aria-label="Search rates"
						placeholder="Search code or description…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<select
						className="block rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 w-47.5"
						aria-label="Filter rate status"
						value={status}
						onChange={(e) => setStatus(e.target.value)}
					>
						<option value="all">All statuses</option>
						<option value="active">Active</option>
						<option value="needs_review">Needs review</option>
						<option value="inactive">Inactive</option>
					</select>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Code / description
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Unit rate
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Status
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Tax
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Review
								</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((rate) => (
								<RateRow key={rate.id} rate={rate} onSave={saveRate} />
							))}
						</tbody>
					</table>
				</div>
				{filtered.length === 0 && (
					<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed mt-3">
						No rates match this filter.
					</div>
				)}
			</section>
		</div>
	);
}

function RateRow({ rate, onSave }: { rate: Rate; onSave: (rate: Rate, status: string, tax: string, rateValue: string) => Promise<void> }) {
	const [nextStatus, setNextStatus] = useState(rate.status);
	const [tax, setTax] = useState(rate.taxTreatment);
	const [rateValue, setRateValue] = useState(rate.rate ?? "");
	const [saving, setSaving] = useState(false);
	return (
		<tr>
			<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
				<strong>{rate.code}</strong>
				<div>{rate.description}</div>
				<div className="text-xs text-muted">Unit: {rate.unit}</div>
				{rate.sourceNotes && <div className="text-xs text-muted">Source note: {rate.sourceNotes}</div>}
			</td>
			<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
				<input
					className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-26.25"
					type="number"
					min="0"
					step="0.01"
					aria-label={`${rate.code} unit rate`}
					value={rateValue}
					onChange={(event) => setRateValue(event.target.value)}
					placeholder="TBC"
				/>
			</td>
			<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
				<select
					className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-33.75"
					aria-label={`${rate.code} status`}
					value={nextStatus}
					onChange={(e) => setNextStatus(e.target.value)}
				>
					<option value="active">Active</option>
					<option value="needs_review">Needs review</option>
					<option value="inactive">Inactive</option>
				</select>
			</td>
			<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
				<select
					className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-w-33.75"
					aria-label={`${rate.code} tax treatment`}
					value={tax}
					onChange={(e) => setTax(e.target.value)}
				>
					<option value="exclusive">Ex VAT</option>
					<option value="inclusive">Inc VAT</option>
					<option value="unknown">Unknown</option>
				</select>
			</td>
			<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
				<button
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
					type="button"
					disabled={saving || (nextStatus === rate.status && tax === rate.taxTreatment && rateValue === (rate.rate ?? ""))}
					onClick={async () => {
						setSaving(true);
						await onSave(rate, nextStatus, tax, rateValue);
						setSaving(false);
					}}
				>
					{saving ? "Saving…" : "Save"}
				</button>
				{rate.reviewNotes && <div className="text-xs text-muted mt-1.25 max-w-50">{rate.reviewNotes}</div>}
			</td>
		</tr>
	);
}
