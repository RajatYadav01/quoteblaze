import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/http";

export async function GET() {
	try {
		const context = await requireAuth();
		return NextResponse.json({
			user: {
				id: context.userId,
				email: context.email,
				fullName: context.fullName,
				role: context.role,
				canApprove: context.canApprove,
			},
			company: { id: context.companyId, name: context.companyName },
		});
	} catch (error) {
		return handleRouteError(error);
	}
}
