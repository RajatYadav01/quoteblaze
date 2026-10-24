"use client";

import { type SubmitEvent, useState } from "react";

type Customer = {
	id: string;
	name: string;
	businessName: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	notes: string | null;
	duplicateGroup?: string | null;
};

export function CustomerDirectory({ initialCustomers }: { initialCustomers: Customer[] }) {
	const [customers, setCustomers] = useState(initialCustomers);
	const [query, setQuery] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [businessName, setBusinessName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [address, setAddress] = useState("");
	const [notes, setNotes] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const filtered = customers.filter((c) =>
		`${c.name} ${c.businessName ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.address ?? ""}`
			.toLowerCase()
			.includes(query.toLowerCase()),
	);
	async function addCustomer(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError("");
		try {
			const response = await fetch("/api/customers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, businessName, email, phone, address, notes }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Could not create customer.");
			setCustomers((old) => [result.customer, ...old]);
			setName("");
			setBusinessName("");
			setEmail("");
			setPhone("");
			setAddress("");
			setNotes("");
			setShowForm(false);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setSaving(false);
		}
	}
	return (
		<div className="grid gap-3">
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<input
						className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 max-w-112.5"
						aria-label="Search customers"
						placeholder="Search name, company, email, phone…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<button
						className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
						type="button"
						onClick={() => setShowForm(!showForm)}
					>
						{showForm ? "Cancel" : "+ Add customer"}
					</button>
				</div>
				{showForm && (
					<form className="mt-4.5" onSubmit={addCustomer}>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="mb-4">
								<label className="mb-1.5 block text-sm font-semibold" htmlFor="customer-name">
									Name *
								</label>
								<input
									id="customer-name"
									className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
									required
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
							<div className="mb-4">
								<label className="mb-1.5 block text-sm font-semibold" htmlFor="customer-business">
									Company
								</label>
								<input
									id="customer-business"
									className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
									value={businessName}
									onChange={(e) => setBusinessName(e.target.value)}
								/>
							</div>
							<div className="mb-4">
								<label className="mb-1.5 block text-sm font-semibold" htmlFor="customer-email">
									Email
								</label>
								<input
									id="customer-email"
									className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<div className="mb-4">
								<label className="mb-1.5 block text-sm font-semibold" htmlFor="customer-phone">
									Phone
								</label>
								<input
									id="customer-phone"
									className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
								/>
							</div>
						</div>
						<div className="mb-4">
							<label className="mb-1.5 block text-sm font-semibold" htmlFor="customer-address">
								Address
							</label>
							<input
								id="customer-address"
								className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
							/>
						</div>
						<div className="mb-4">
							<label className="mb-1.5 block text-sm font-semibold" htmlFor="customer-notes">
								Notes
							</label>
							<textarea
								id="customer-notes"
								className="block w-full resize-y rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 leading-relaxed text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15 min-h-20"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
							/>
						</div>
						{error && (
							<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]">
								{error}
							</div>
						)}
						<button
							type="submit"
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
							disabled={saving}
						>
							{saving ? "Saving…" : "Save customer"}
						</button>
					</form>
				)}
			</section>
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
					<h2 className="m-0 text-lg font-semibold tracking-tight">Customer directory</h2>
					<span className="text-xs text-muted">{filtered.length} records</span>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Name
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Company
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Contact
								</th>
								<th className="border-b border-[#ebefea] bg-[#f9faf7] px-3.5 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted">
									Address / notes
								</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((c) => (
								<tr key={c.id}>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										<strong>{c.name}</strong>
										{c.duplicateGroup && (
											<div className="text-xs text-muted">Possible duplicate group: {c.duplicateGroup}</div>
										)}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{c.businessName ?? "—"}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{c.email && <div>{c.email}</div>}
										{c.phone && <div className="text-muted text-xs">{c.phone}</div>}
									</td>
									<td className="border-b border-[#ebefea] px-3.5 py-3 align-top last:border-b-0">
										{c.address ?? "—"}
										{c.notes && <div className="text-xs text-muted max-w-xs mt-1">{c.notes}</div>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{filtered.length === 0 && (
					<div className="rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed mt-3">
						No matching customers.
					</div>
				)}
			</section>
		</div>
	);
}
