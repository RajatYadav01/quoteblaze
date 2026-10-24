import { EnquiryWorkbench } from "@/features/enquiries/enquiry-workbench";

export default function EnquiriesPage() {
	return (
		<>
			<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-[2.3rem]">New enquiry</h1>
					<p className="max-w-175 leading-relaxed text-muted">
						Save the original message, analyse it with your company's OpenRouter configuration, and produce a draft for human
						review.
					</p>
				</div>
			</div>
			<EnquiryWorkbench />
		</>
	);
}
