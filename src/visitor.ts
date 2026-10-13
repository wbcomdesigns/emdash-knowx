import type { PluginContext } from "emdash/plugin";

import { asString } from "./util";

export async function visitorHash(
	ctx: PluginContext,
	routeCtx: { requestMeta?: unknown },
	input: unknown,
): Promise<string> {
	const meta = routeCtx.requestMeta && typeof routeCtx.requestMeta === "object" ? routeCtx.requestMeta : {};
	const ip = asString((meta as { ip?: unknown }).ip);
	const vid = asString((input as { vid?: unknown } | null)?.vid);
	const material = ip || vid || "shared";
	let salt = asString(await ctx.kv.get<string>("visitor_salt"));
	if (!salt) {
		salt = crypto.randomUUID();
		await ctx.kv.set("visitor_salt", salt);
	}
	const bytes = new TextEncoder().encode(`${salt}:${material}`);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normaliseTerm(raw: unknown): string {
	return asString(raw).toLowerCase().slice(0, 80);
}

export function skipSearchTerm(term: string): boolean {
	if (!term) return true;
	if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(term)) return true;
	if (/\d{6,}/.test(term.replace(/\s+/g, ""))) return true;
	return false;
}
