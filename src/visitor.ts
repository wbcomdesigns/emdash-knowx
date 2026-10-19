import type { PluginContext } from "emdash/plugin";

import { asString } from "./util";
import { guestKey } from "./visitor-key";

type Ctx = Pick<PluginContext, "kv">;

const SALT = "visitor_salt";

async function sha256(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** One salt per site. Compare-and-set, so two first requests at once cannot each write their own. */
export async function visitorSalt(ctx: Ctx): Promise<string> {
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const seen = await ctx.kv.getVersioned<string>(SALT);
		if (seen?.value) return seen.value;
		const next = crypto.randomUUID();
		if ((await ctx.kv.compareAndSet(SALT, seen?.revision ?? null, next)).applied) return next;
	}
	return asString(await ctx.kv.get<string>(SALT)) || crypto.randomUUID();
}

/** The key this request's guest is counted by, or null when there is no usable address. */
export function requestAddress(routeCtx: { requestMeta?: unknown }): string | null {
	const ip = (routeCtx.requestMeta as { ip?: unknown } | undefined)?.ip;
	// Shared guestKey (wbcom starter): null for no address or one it cannot parse. Both mean the
	// guest is asked to sign in (owner decision 2026-10-16); there is never a fallback key.
	return typeof ip === "string" ? guestKey(ip) : null;
}

/** Hash of a guest address or a member id with the site salt. Never the address itself. */
export async function visitorHash(ctx: Ctx, who: { address: string } | { member: string }): Promise<string> {
	const material = "address" in who ? `ip:${who.address}` : `member:${who.member}`;
	return sha256(`${await visitorSalt(ctx)}:${material}`);
}

export function normaliseTerm(raw: unknown): string {
	return asString(raw).toLowerCase().slice(0, 80);
}

/** Terms never stored: empty, an email address, or a phone or card number in any spacing. */
export function skipSearchTerm(term: string): boolean {
	if (!term) return true;
	if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(term)) return true;
	if (/\d{6,}/.test(term.replace(/[\s\-.()+/]/g, ""))) return true;
	return false;
}
