import { SettingsManager } from "@/features/company-settings/settings-manager";

export default function SettingsPage() {
	return (
		<>
			<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-[2.3rem]">Settings</h1>
					<p className="max-w-175 leading-relaxed text-muted">
						Configure pricing rules, safety thresholds, and this company's OpenRouter connection.
					</p>
				</div>
			</div>
			<SettingsManager />
		</>
	);
}
