import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "database",
		environment: "node",
		include: ["test/**/*.test.ts"],
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
