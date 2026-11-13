"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { VisibilityToggleInput } from "@/components/ui/visibility-toggle-input";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			const result = await response.json();
			if (!response.ok) {
				setError(result.error ?? "Unable to sign in.");
				return;
			}
			router.replace("/dashboard");
			router.refresh();
		} catch {
			setError("Could not connect to Quoteblaze. Check the server and try again.");
		} finally {
			setLoading(false);
		}
	}
	return (
		<main className="grid min-h-screen grid-cols-1 bg-sidebar md:grid-cols-[1.1fr_1fr]">
			<section className="flex flex-col justify-between bg-[radial-gradient(ellipse_at_top_left,#6b3928,transparent_60%),var(--color-sidebar)] p-6 text-sidebar-foreground md:p-[8vw]">
				<div className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.04em]">
					<span className="grid size-8.5 shrink-0 place-items-center rounded-[11px] bg-accent font-black text-ink">Q</span>
					<span>Quoteblaze</span>
				</div>
				<div>
					<h1 className="mt-10 mb-5 max-w-162.5 text-5xl font-semibold leading-none tracking-[-0.065em] md:text-7xl">
						Get the quote out. Keep the human in charge.
					</h1>
					<p className="mb-0 max-w-125 leading-relaxed text-sidebar-muted">
						Turn customer enquiries into clear, itemised draft quotes using your own price list. Every quote stays under your
						team's control.
					</p>
				</div>
				<p className="leading-relaxed text-xs">Built for contractors who would rather be on site than quoting at 10pm.</p>
			</section>
			<section className="grid place-items-center bg-paper p-[38px_24px] md:p-7">
				<form className="w-full max-w-105" onSubmit={submit}>
					<h2 className="mb-3.5 text-lg font-semibold tracking-tight">Welcome back</h2>
					<p className="mb-7 max-w-175 leading-relaxed text-muted">Sign in to your company workspace.</p>
					{error && (
						<div
							className="rounded-xl border px-3.5 py-3 text-sm leading-relaxed border-danger-border bg-danger-bg text-danger-text mb-4"
							role="alert"
						>
							{error}
						</div>
					)}
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="email">
							Email address
						</label>
						<input
							id="email"
							autoComplete="username"
							className="block w-full rounded-xl border border-input-border bg-white px-3 py-2.5 text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
					<div className="mb-4">
						<label className="mb-1.5 block text-sm font-semibold" htmlFor="password">
							Password
						</label>
						<VisibilityToggleInput
							id="password"
							visibilityLabel="password"
							autoComplete="current-password"
							className="block w-full rounded-xl border border-input-border bg-white px-3 py-2.5 text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>
					<button
						className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand text-white hover:bg-brand-dark w-full mt-2"
						disabled={loading}
						type="submit"
					>
						{loading ? "Signing in…" : "Sign in"}
					</button>
					<p className="leading-relaxed mt-4.5 text-xs text-muted">Each account only sees its own company data.</p>
				</form>
			</section>
		</main>
	);
}
