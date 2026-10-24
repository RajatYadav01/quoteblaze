import { asc, eq } from "drizzle-orm";
import { RateCatalogManager } from "@/features/rate-catalog/rate-catalog-manager";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export default async function RatesPage() {
	const auth = await requireAuth();
	const rates = await db
		.select()
		.from(schema.rates)
		.where(eq(schema.rates.companyId, auth.companyId))
		.orderBy(asc(schema.rates.code))
		.limit(500);
	const counts = {
		active: rates.filter((r) => r.status === "active").length,
		review: rates.filter((r) => r.status === "needs_review").length,
		inactive: rates.filter((r) => r.status === "inactive").length,
	};
	return (
		<>
			<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-[2.3rem]">Rate catalogue</h1>
					<p className="max-w-175 leading-relaxed text-muted">
						These are the rates available to your company only. Ambiguous source values remain visible but cannot be used for
						complete quotations.
					</p>
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-4.5">
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Total rows</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{rates.length}</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Active</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{counts.active}</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Needs review</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{counts.review}</div>
				</div>
				<div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_5px_18px_rgba(31,60,48,0.035)]">
					<div className="text-[0.82rem] text-muted">Inactive / TBC</div>
					<div className="mt-2 text-3xl font-bold tracking-[-0.045em]">{counts.inactive}</div>
				</div>
			</div>
			<RateCatalogManager initialRates={rates} />
		</>
	);
}
