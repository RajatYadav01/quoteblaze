import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Quoteblaze — Clear quotes, less admin",
	description: "AI-assisted quoting for independent contractors, with human approval built in.",
	icons: {
		icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
		shortcut: "/favicon.svg",
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en-GB">
			<body className="min-h-screen bg-paper font-sans text-ink antialiased">{children}</body>
		</html>
	);
}
