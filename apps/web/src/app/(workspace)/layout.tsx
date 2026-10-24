import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/features/tenants/workspace-shell";
import { getAuthContext } from "@/lib/auth/session";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const auth = await getAuthContext();
	if (!auth) redirect("/login");
	return <WorkspaceShell auth={auth}>{children}</WorkspaceShell>;
}
