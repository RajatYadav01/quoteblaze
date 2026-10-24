import { notFound } from "next/navigation";
import { QuoteReview } from "@/features/quoting/quote-review";
import { getQuote } from "@/features/quoting/service";
import { requireAuth } from "@/lib/auth/session";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const auth = await requireAuth();
	const { id } = await params;
	const result = await getQuote(auth.companyId, id);
	if (!result?.quote || !result?.revision) notFound();
	const analysis =
		result.enquiryAnalysis && typeof result.enquiryAnalysis === "object"
			? (result.enquiryAnalysis as { missingInformation?: string[] })
			: {};
	return (
		<QuoteReview
			quote={result.quote}
			revision={result.revision}
			customerName={result.customerName}
			customerEmail={result.customerEmail}
			canApprove={auth.canApprove || ["owner", "admin"].includes(auth.role)}
			resolvableBlockers={analysis.missingInformation ?? []}
		/>
	);
}
