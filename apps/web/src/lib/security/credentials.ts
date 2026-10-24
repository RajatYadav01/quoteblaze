import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyMaterial(): Buffer {
	const raw = process.env.APP_ENCRYPTION_KEY;
	if (!raw) throw new Error("APP_ENCRYPTION_KEY is required to store AI credentials.");
	const key = Buffer.from(raw, "base64");
	if (key.length !== 32)
		throw new Error("APP_ENCRYPTION_KEY must be base64 for exactly 32 bytes (generate with openssl rand -base64 32).");
	return key;
}

export function encryptSecret(plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
	const [ivPart, tagPart, encryptedPart] = payload.split(".");
	if (!ivPart || !tagPart || !encryptedPart) throw new Error("Stored credential format is invalid.");
	const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivPart, "base64url"));
	decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
	return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString("utf8");
}
