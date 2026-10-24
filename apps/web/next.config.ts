import { resolve } from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// pnpm runs this config from apps/web; load the monorepo-root .env for local development.
config({ path: resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
	transpilePackages: [
		"@quoteblaze/types",
		"@quoteblaze/schemas",
		"@quoteblaze/constants",
		"@quoteblaze/database",
		"@quoteblaze/pricing-engine",
	],
	poweredByHeader: false,
};

export default nextConfig;
