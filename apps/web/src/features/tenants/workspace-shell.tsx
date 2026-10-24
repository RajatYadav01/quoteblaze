"use client";

import { APP_NAME } from "@quoteblaze/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/features/auth/logout-button";
import type { AuthContext } from "@/lib/auth/session";

const links = [
	["/dashboard", "Overview"],
	["/enquiries", "Enquiries"],
	["/quotes", "Quotes"],
	["/customers", "Customers"],
	["/rates", "Rate catalogue"],
	["/settings", "Settings"],
] as const;

export function WorkspaceShell({ auth, children }: { auth: AuthContext; children: React.ReactNode }) {
	const pathname = usePathname();
	return (
		<div className="grid min-h-screen grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)]">
			<aside className="flex flex-col gap-3 bg-[#17382f] p-3 text-[#edf5ed] md:gap-7 md:px-4.5 md:py-6.5">
				<Link className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.04em]" href="/dashboard">
					<span className="grid size-8.5 shrink-0 place-items-center rounded-[11px] bg-[#a9e3bb] font-black text-[#143f31]">
						Q
					</span>
					<span>{APP_NAME}</span>
				</Link>
				<nav className="grid gap-1.5 max-md:flex max-md:overflow-x-auto" aria-label="Main navigation">
					{links.map(([href, label]) => (
						<Link
							key={href}
							className={`rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${pathname.startsWith(href) ? "bg-[#2b5145] text-white" : "text-[#bed0c7] hover:bg-[#2b5145] hover:text-white"}`}
							href={href}
						>
							{label}
						</Link>
					))}
				</nav>
				<div className="mt-auto border-t border-[#426356] p-3 text-xs text-[#aec6b8] max-md:hidden">
					<strong>{auth.companyName}</strong>
					<br />
					Signed in as {auth.fullName}
					<br />
					<span className="text-xs">{auth.role.replaceAll("_", " ")}</span>
				</div>
			</aside>
			<div className="min-w-0">
				<header className="flex items-center justify-between border-b border-line bg-white/70 px-4 py-3.5 sm:px-8 sm:py-4.5">
					<div>
						<strong>{auth.companyName}</strong>
						<p className="max-w-175 leading-relaxed text-muted text-sm">AI-assisted quoting · human approval required</p>
					</div>
					<LogoutButton />
				</header>
				<main className="mx-auto w-full max-w-362.5 px-4 py-5 pb-10 md:px-6 md:py-6 lg:px-8 lg:py-7.5 lg:pb-12">{children}</main>
			</div>
		</div>
	);
}
