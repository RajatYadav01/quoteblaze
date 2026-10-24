import "server-only";
import { db, schema } from "@/lib/db";

export async function writeAudit(input: {
	companyId: string;
	actorUserId?: string | null;
	action: string;
	resourceType: string;
	resourceId?: string | null;
	metadata?: Record<string, unknown>;
}) {
	await db.insert(schema.auditEvents).values({
		companyId: input.companyId,
		actorUserId: input.actorUserId ?? null,
		action: input.action,
		resourceType: input.resourceType,
		resourceId: input.resourceId ?? null,
		metadata: input.metadata ?? {},
	});
}
