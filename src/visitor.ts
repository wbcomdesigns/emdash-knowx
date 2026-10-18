import type { PluginContext } from "emdash/plugin";

import { asString } from "./util";

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

/**
 * The address a guest is counted by, or null when the host gave none. EmDash only fills the IP on
 * Cloudflare, or when the site sets trustedProxyHeaders. An IPv6 visitor counts by the /64 network,
 * so rotating addresses inside one network is still one guest.
 */
export function guestAddress(value: unknown): string | null {
	const ip = asString(value).toLowerCase().replace(/%.*$/, "");
	if (!ip || ip === "unknown") return null;
	if (!ip.includes(":")) return ip;
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
	if (mapped) return mapped[1];
	const [head = "", tail = ""] = ip.split("::");
	const left = head ? head.split(":") : [];
	const right = ip.includes("::") && tail ? tail.split(":") : [];
	const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
	return `${groups
		.slice(0, 4)
		.map((group) => (Number.parseInt(group, 16) || 0).toString(16))
		.join(":")}::/64`;
}

/** The guest address of this request, or null. */
export function requestAddress(routeCtx: { requestMeta?: unknown }): string | null {
	const meta = routeCtx.requestMeta as { ip?: unknown } | undefined;
	return guestAddress(meta?.ip);
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
