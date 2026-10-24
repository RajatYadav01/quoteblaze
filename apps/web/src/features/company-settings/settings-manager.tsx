"use client";

import { type SubmitEvent, useCallback, useEffect, useState } from "react";
import { VisibilityToggleInput } from "@/components/ui/visibility-toggle-input";

type AiSettings = { configured: boolean; model: string; lastTestedAt: string | null };
type CatalogModel = {
	id: string;
	name: string;
	contextLength: number | null;
	promptUsdPerMillion: number | null;
	completionUsdPerMillion: number | null;
	inputModalities: string[];
	outputModalities: string[];
};

function priceLabel(value: number | null): string {
	return value === null ? "price not listed" : value === 0 ? "free" : `$${value.toFixed(4)} / 1M tokens`;
}

export function SettingsManager() {
	const [ai, setAi] = useState<AiSettings | null>(null);
	const [vatRate, setVatRate] = useState("20");
	const [minimumCharge, setMinimumCharge] = useState("450");
	const [validity, setValidity] = useState("30");
	const [threshold, setThreshold] = useState("500");
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState("openrouter/free");
	const [modelSearch, setModelSearch] = useState("");
	const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [searchingModels, setSearchingModels] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [catalogMessage, setCatalogMessage] = useState("");

	const load = useCallback(async () => {
		try {
			const [sRes, aiRes] = await Promise.all([fetch("/api/settings"), fetch("/api/settings/ai-credentials")]);
			const s = await sRes.json();
			const a = await aiRes.json();
			if (!sRes.ok) throw new Error(s.error ?? "Unable to load company settings.");
			if (!aiRes.ok) throw new Error(a.error ?? "Unable to load AI status.");
			setAi({ ...a, model: a.model ?? "openrouter/free" });
			setVatRate(String(Math.round(s.settings.vatRate * 100)));
			setMinimumCharge(String(s.settings.minimumCharge));
			setValidity(String(s.settings.quoteValidityDays));
			setThreshold(String(s.settings.siteVisitThresholdM2));
			setModel(a.model ?? "openrouter/free");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);

	async function saveBusiness(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					vatRate: Number(vatRate) / 100,
					minimumCharge: Number(minimumCharge),
					quoteValidityDays: Number(validity),
					siteVisitThresholdM2: Number(threshold),
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Could not save settings.");
			setMessage("Company settings saved.");
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setSaving(false);
		}
	}

	async function saveAi(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError("");
		setMessage("");
		try {
			if (!ai?.configured && !apiKey.trim()) throw new Error("Enter an OpenRouter API key to configure AI for the first time.");
			const body: { apiKey?: string; model: string } = { model: model.trim() };
			if (apiKey.trim()) body.apiKey = apiKey.trim();
			const saveResponse = await fetch("/api/settings/ai-credentials", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const saved = await saveResponse.json();
			if (!saveResponse.ok) throw new Error(saved.error ?? "Connection test or save failed.");
			setApiKey("");
			setMessage("Selected model tested successfully and AI settings saved securely.");
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setSaving(false);
		}
	}

	async function browseModels() {
		setSearchingModels(true);
		setError("");
		setCatalogMessage("");
		try {
			const body: { apiKey?: string; query: string } = { query: modelSearch.trim() };
			if (apiKey.trim()) body.apiKey = apiKey.trim();
			const response = await fetch("/api/settings/ai-models", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Unable to browse OpenRouter models.");
			setCatalogModels(result.models as CatalogModel[]);
			setCatalogMessage(`${(result.models as CatalogModel[]).length} model(s) found. Select one or enter any model ID manually.`);
		} catch (e) {
			setCatalogModels([]);
			setError(e instanceof Error ? e.message : "Unable to browse OpenRouter models.");
		} finally {
			setSearchingModels(false);
		}
	}

	async function deleteAi() {
		if (!window.confirm("Remove this company's saved OpenRouter credential? Existing enquiries will be kept.")) return;
		setSaving(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/settings/ai-credentials", { method: "DELETE" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Could not remove credential.");
			setMessage("Company AI credential removed.");
			setCatalogModels([]);
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unexpected error.");
		} finally {
			setSaving(false);
		}
	}

	if (loading)
		return (
			<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				Loading settings…
			</div>
		);
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
            {(message || error) && (
				<div
					className={`rounded-xl border border-[#dce6de] bg-[#f1f5f2] px-3.5 py-3 text-sm leading-relaxed ${error ? "border-[#f0c9c1] bg-[#fff1ee] text-[#8d2e23]" : "border-[#c6e7cf] bg-[#eaf7ed] text-[#245a39]"} col-span-full`}
					role="status"
				>
					{error || message}
				</div>
			)}
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Company quoting rules</h2>
				<p className="leading-relaxed text-muted text-xs">
					These values are used by the deterministic pricing engine. They are not AI suggestions.
				</p>
				<form onSubmit={saveBusiness}>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="vat-rate">
							VAT rate (%)
						</label>
						<input
							className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="vat-rate"
							type="number"
							min="0"
							max="100"
							step="0.1"
							required
							value={vatRate}
							onChange={(e) => setVatRate(e.target.value)}
						/>
					</div>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="min-charge">
							Minimum job charge (£, ex VAT)
						</label>
						<input
							className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="min-charge"
							type="number"
							min="0"
							step="0.01"
							required
							value={minimumCharge}
							onChange={(e) => setMinimumCharge(e.target.value)}
						/>
					</div>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="validity">
							Quote validity (days)
						</label>
						<input
							className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="validity"
							type="number"
							min="1"
							max="365"
							required
							value={validity}
							onChange={(e) => setValidity(e.target.value)}
						/>
					</div>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="threshold">
							Site-visit threshold (m²)
						</label>
						<input
							className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="threshold"
							type="number"
							min="1"
							step="1"
							required
							value={threshold}
							onChange={(e) => setThreshold(e.target.value)}
						/>
						<p className="leading-relaxed mt-1.5 text-xs text-muted">
							Commercial work above this area is sent for a site visit instead of being priced from email alone.
						</p>
					</div>
					<button
						className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
						disabled={saving}
						type="submit"
					>
						{saving ? "Saving…" : "Save quoting rules"}
					</button>
				</form>
			</section>
			<section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="m-0 text-lg font-semibold tracking-tight">AI configuration</h2>
					<span
						className={`inline-flex whitespace-nowrap rounded-full bg-[#eef3ef] px-2.5 py-1 text-xs font-bold text-[#40534b] ${ai?.configured ? "bg-[#e0f5e7] text-[#17643f]" : "bg-[#fff0d6] text-[#855c0a]"}`}
					>
						{ai?.configured ? "Configured" : "Key required"}
					</span>
				</div>
				<p className="leading-relaxed text-muted text-xs">
					Each company supplies its own OpenRouter API key. Quoteblaze encrypts it server-side and never returns the plaintext
					after saving.
				</p>
				{ai?.configured && (
					<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#c6e7cf] bg-[#eaf7ed] text-[#245a39] mb-4">
						Saved key: ••••••••••••••••
						<br />
						Selected model: {ai.model}
						<br />
						{ai.lastTestedAt
							? `Last tested: ${new Date(ai.lastTestedAt).toLocaleString("en-GB")}`
							: "Connection has not been recorded as tested."}
					</div>
				)}
				<form onSubmit={saveAi}>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="openrouter-key">
							OpenRouter API key
						</label>
						<VisibilityToggleInput
							className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="openrouter-key"
							visibilityLabel="OpenRouter API key"
							autoComplete="new-password"
							placeholder={ai?.configured ? "Leave blank to keep saved key, or enter a new key" : "sk-or-v1-…"}
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
						/>
						<p className="leading-relaxed mt-1.5 text-xs text-muted">
							Create a key from your OpenRouter account. The key is sent to this server over HTTPS and encrypted at rest.
							Leave blank to change models while keeping a saved key.
						</p>
					</div>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="model">
							OpenRouter model ID
						</label>
						<input
							className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
							id="model"
							name="model"
							autoComplete="off"
							spellCheck={false}
							required
							maxLength={200}
							value={model}
							onChange={(e) => setModel(e.target.value)}
							placeholder="anthropic/claude-sonnet-4"
						/>
						<p className="leading-relaxed mt-1.5 text-xs text-muted">
							Enter an exact model ID from OpenRouter, including the provider prefix and optional variant (for example,
							:free). The default is openrouter/free, but any compatible text chat model is allowed. The connection test
							verifies the ID before saving.
						</p>
					</div>
					<div className="mb-4 rounded-xl border border-slate-200 p-3">
						<h3 className="text-base font-semibold tracking-tight mt-0 mb-1">Browse OpenRouter models</h3>
						<p className="leading-relaxed mt-1.5 text-xs text-muted">
							Search by model name or ID. Use the API key above for this search, or the saved key if the key field is blank.
							You can always enter a model ID manually.
						</p>
						<div className="flex flex-wrap items-end gap-2">
							<div className="flex-1 mb-0">
								<label className="mb-1.5 block text-sm font-semibold" htmlFor="model-search">
									Search catalogue
								</label>
								<input
									className="block w-full rounded-xl border border-[#d1dcd3] bg-white px-3 py-2.5 text-ink outline-none focus:border-[#419778] focus:ring-4 focus:ring-emerald-700/15"
									id="model-search"
									value={modelSearch}
									onChange={(e) => setModelSearch(e.target.value)}
									placeholder="Claude, GPT, Gemini, Llama…"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											void browseModels();
										}
									}}
								/>
							</div>
							<button
								className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
								type="button"
								disabled={searchingModels}
								onClick={() => void browseModels()}
							>
								{searchingModels ? "Searching…" : "Search models"}
							</button>
						</div>
						{catalogMessage && (
							<p className="leading-relaxed mt-1.5 text-xs text-muted" role="status">
								{catalogMessage}
							</p>
						)}
						{catalogModels.length > 0 && (
							<div className="grid gap-2 mt-2.5 max-h-80 overflow-y-auto">
								{catalogModels.map((entry) => (
									<div className="border-t border-slate-200 pt-2 flex justify-between items-start gap-3" key={entry.id}>
										<div className="min-w-0">
											<strong>{entry.name}</strong>
											<div className="text-xs text-muted wrap-break-word">{entry.id}</div>
											<div className="text-xs text-muted">
												Context: {entry.contextLength ? entry.contextLength.toLocaleString() : "not listed"} tokens
												· Input {priceLabel(entry.promptUsdPerMillion)} · Output{" "}
												{priceLabel(entry.completionUsdPerMillion)}
											</div>
										</div>
										<button
											className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
											type="button"
											onClick={() => setModel(entry.id)}
											aria-label={`Use ${entry.id}`}
										>
											Use model
										</button>
									</div>
								))}
							</div>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark"
							type="submit"
							disabled={saving}
						>
							{saving ? "Testing and saving…" : "Test model and save settings"}
						</button>
						{ai?.configured && (
							<button
								className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-[#f1c9c2] bg-[#fff2ef] text-[#9c3225]"
								type="button"
								disabled={saving}
								onClick={deleteAi}
							>
								Remove key
							</button>
						)}
					</div>
				</form>
				<hr className="my-4.5 border-0 border-t border-line" />
				<div className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-[#f2deb0] bg-[#fff8e9] text-[#754f09]">
					Customer enquiry text is sent to the selected model through OpenRouter for analysis. Check your provider's data-handling
					and retention terms before sending customer information.
				</div>
			</section>
		</div>
	);
}
