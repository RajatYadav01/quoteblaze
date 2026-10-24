import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"./apps/web/vitest.config.ts",
			"./packages/database/vitest.config.ts",
			"./packages/pricing-engine/vitest.config.ts",
			"./packages/schemas/vitest.config.ts",
		],
	},
});
