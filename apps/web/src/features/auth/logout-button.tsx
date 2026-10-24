"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
	const router = useRouter();
	async function logout() {
		await fetch("/api/auth/logout", { method: "POST" });
		router.replace("/login");
		router.refresh();
	}
	return (
		<button
			className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-line bg-white text-ink hover:bg-[#f3f6f1]"
			onClick={logout}
			type="button"
		>
			Sign out
		</button>
	);
}
