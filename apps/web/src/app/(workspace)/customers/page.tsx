import { asc, eq } from "drizzle-orm";
import { CustomerDirectory } from "@/features/customers/customer-directory";
import { requireAuth } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export default async function CustomersPage() {
	const auth = await requireAuth();
	const customers = await db
		.select()
		.from(schema.customers)
		.where(eq(schema.customers.companyId, auth.companyId))
		.orderBy(asc(schema.customers.name))
		.limit(500);
	return (
		<>
			<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-[2.3rem]">Customers</h1>
					<p className="max-w-175 leading-relaxed text-muted">
						Your company-only customer directory. Similar records are preserved until a human resolves duplicates.
					</p>
				</div>
			</div>
			<CustomerDirectory initialCustomers={customers} />
		</>
	);
}
