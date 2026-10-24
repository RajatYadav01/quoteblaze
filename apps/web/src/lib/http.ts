import { NextResponse } from "next/server";
import { AuthRequiredError, PermissionDeniedError } from "@/lib/auth/session";

export function jsonError(message: string, status = 400, details?: unknown) {
	return NextResponse.json({ error: message, ...(details === undefined ? {} : { details }) }, { status });
}

export function handleRouteError(error: unknown) {
	if (error instanceof AuthRequiredError) return jsonError("Authentication required.", 401);
	if (error instanceof PermissionDeniedError) return jsonError(error.message, 403);
	if (error instanceof SyntaxError) return jsonError("Invalid JSON request body.", 400);
	console.error(
		"Quoteblaze route error",
		error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
	);
	return jsonError("The request could not be completed.", 500);
}
