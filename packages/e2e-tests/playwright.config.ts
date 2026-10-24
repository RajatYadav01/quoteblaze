import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.QUOTEBLAZE_E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: false,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: { baseURL, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
	webServer: process.env.QUOTEBLAZE_E2E_BASE_URL
		? undefined
		: {
				command: "pnpm --filter @quoteblaze/web dev",
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			},
});
