import { expect, test } from "@playwright/test";

const hollis = {
	email: process.env.QUOTEBLAZE_HOLLIS_EMAIL ?? "dave@hollisgroundworks.example",
	password: process.env.QUOTEBLAZE_HOLLIS_PASSWORD ?? "HollisDemo!2026",
};
const greenfield = {
	email: process.env.QUOTEBLAZE_GREENFIELD_EMAIL ?? "gaz@greenfieldlandscapes.example",
	password: process.env.QUOTEBLAZE_GREENFIELD_PASSWORD ?? "GreenfieldDemo!2026",
};

async function signIn(page: import("@playwright/test").Page, credentials: { email: string; password: string }) {
	await page.goto("/login");
	await page.getByLabel("Work email").fill(credentials.email);
	await page.getByLabel("Password").fill(credentials.password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/dashboard/);
}

test("protected API requires authentication", async ({ request }) => {
	const response = await request.get("/api/customers");
	expect(response.status()).toBe(401);
});

test("Hollis user sees their own imported contacts", async ({ page }) => {
	await signIn(page, hollis);
	await page.goto("/customers");
	await expect(page.getByText("Patience Okafor", { exact: true })).toBeVisible();
	await expect(page.getByText("Greenfield Landscapes", { exact: true })).toHaveCount(0);
});

test("tenant data is isolated between companies", async ({ page }) => {
	await signIn(page, hollis);
	const hollisCustomers = await page.evaluate(
		async () => (await (await fetch("/api/customers")).json()).customers as Array<{ email: string | null }>,
	);
	expect(hollisCustomers.some((row) => row.email === "facilities@greenwaycare.example")).toBe(true);
	await page.request.post("/api/auth/logout");
	await signIn(page, greenfield);
	const greenfieldCustomers = await page.evaluate(
		async () => (await (await fetch("/api/customers")).json()).customers as Array<{ email: string | null }>,
	);
	expect(greenfieldCustomers.some((row) => row.email === "facilities@greenwaycare.example")).toBe(false);
});

test("AI key endpoint never returns the plaintext credential", async ({ page }) => {
	await signIn(page, hollis);
	const response = await page.request.get("/api/settings/ai-credentials");
	expect(response.ok()).toBe(true);
	const body = await response.json();
	expect(body).not.toHaveProperty("apiKey");
	expect(body).not.toHaveProperty("encryptedKey");
});

test("a company cannot mutate another tenant's rate by guessing its record id", async ({ page }) => {
	await signIn(page, hollis);
	const response = await page.request.get("/api/rates");
	const body = await response.json();
	const hollisRate = (body.rates as Array<{ id: string; code: string }>).find((rate) => rate.code === "BP01");
	expect(hollisRate).toBeTruthy();
	if (!hollisRate) throw new Error("Hollis seed rate BP01 was not found.");
	await page.request.post("/api/auth/logout");
	await signIn(page, greenfield);
	const attempt = await page.request.patch(`/api/rates/${hollisRate.id}`, { data: { status: "inactive" } });
	expect(attempt.status()).toBe(404);
});

test("favicon is available and sensitive fields can be shown and hidden", async ({ page }) => {
	await page.goto("/login");

	await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /favicon\.svg/);
	const faviconResponse = await page.request.get("/favicon.svg");
	expect(faviconResponse.ok()).toBe(true);
	expect(faviconResponse.headers()["content-type"]).toContain("image/svg+xml");

	const passwordInput = page.getByLabel("Password");
	await expect(passwordInput).toHaveAttribute("type", "password");
	await page.getByRole("button", { name: "Show password" }).click();
	await expect(passwordInput).toHaveAttribute("type", "text");
	await page.getByRole("button", { name: "Hide password" }).click();
	await expect(passwordInput).toHaveAttribute("type", "password");

	await signIn(page, hollis);
	await page.goto("/settings");
	const apiKeyInput = page.getByLabel("OpenRouter API key");
	await expect(apiKeyInput).toHaveAttribute("type", "password");
	await page.getByRole("button", { name: "Show OpenRouter API key" }).click();
	await expect(apiKeyInput).toHaveAttribute("type", "text");
	await page.getByRole("button", { name: "Hide OpenRouter API key" }).click();
	await expect(apiKeyInput).toHaveAttribute("type", "password");
});
