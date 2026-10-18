import { afterEach, describe, expect, it } from "vitest";

import { parseContactUrl } from "../src/settings";
import { skipSearchTerm } from "../src/visitor";
import { guestKey } from "../src/visitor-key";
import { ana, guest, openSite, withDocs } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

const noAddress = guest(null);
const asMember = (user = ana) => ({ method: "POST", user, meta: { ip: null, userAgent: null, referer: null, geo: null } });

async function insightsJson(site: Awaited<ReturnType<typeof openSite>>): Promise<string> {
	return JSON.stringify(await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST" }));
}

describe("guests need a visitor address (#40)", () => {
	it("refuses a guest vote and a guest search with no address, and stores nothing", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		expect(await site.call("helpful", { id: ids[0], helpful: false, comment: "spam" }, noAddress)).toMatchObject({
			ok: false,
			error: { code: "GUEST_UNAVAILABLE" },
		});
		expect(await site.call("log_search", { q: "invented term", found: 0 }, noAddress)).toMatchObject({
			ok: false,
			error: { code: "GUEST_UNAVAILABLE" },
		});
		// "unknown" is what some proxies send, and garbage cannot be parsed: both count as no address.
		expect(await site.call("helpful", { id: ids[0], helpful: true }, guest("not-an-ip"))).toMatchObject({
			error: { code: "GUEST_UNAVAILABLE" },
		});
		expect(await site.call("helpful", { id: ids[0], helpful: true }, guest("unknown"))).toMatchObject({
			error: { code: "GUEST_UNAVAILABLE" },
		});
		expect(await site.call("tally", { id: ids[0] })).toMatchObject({ yes: 0, no: 0 });
		const page = await insightsJson(site);
		expect(page).not.toContain("invented term");
		expect(page).not.toContain("spam");
	});

	it("health says whether guests can write here", async () => {
		const site = await openSite();
		dispose = site.dispose;
		expect(await site.call("health", {}, { method: "GET", meta: { ip: null, userAgent: null, referer: null, geo: null } })).toMatchObject({
			guestWrites: false,
		});
		expect(await site.call("health", {}, { method: "GET", meta: { ip: "203.0.113.9", userAgent: null, referer: null, geo: null } })).toMatchObject({
			guestWrites: true,
		});
	});

	it("an IPv4 guest votes and is limited to 8 writes an hour", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		const ipv4 = guest("203.0.113.10");
		for (let i = 0; i < 8; i += 1) {
			expect(await site.call("helpful", { id: ids[0], helpful: i % 2 === 0 }, ipv4)).toMatchObject({ ok: true });
		}
		expect(await site.call("helpful", { id: ids[0], helpful: true }, ipv4)).toMatchObject({ error: { code: "RATE_LIMITED" } });
		// One visitor, one vote: the last counted vote replaced the earlier ones.
		expect(await site.call("tally", { id: ids[0] })).toMatchObject({ yes: 0, no: 1 });
	});

	it("two IPv6 addresses in one /64 are one guest", async () => {
		expect(guestKey("2001:db8:1:2::1")).toBe(guestKey("2001:db8:1:2:ffff:ffff:ffff:fffe"));
		expect(guestKey("2001:db8:1:2::1")).not.toBe(guestKey("2001:db8:1:3::1"));
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		await site.call("helpful", { id: ids[0], helpful: true }, guest("2001:db8:1:2::1"));
		const second = await site.call("helpful", { id: ids[0], helpful: false }, guest("2001:db8:1:2:abcd::7"));
		expect(second).toMatchObject({ ok: true, yes: 0, no: 1 });
	});

	it("a signed-in member votes with no address; the member route refuses guests", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		expect(await site.call("helpful_member", { id: ids[0], helpful: true }, asMember())).toMatchObject({ ok: true, yes: 1 });
		// EmDash answers 401 before the handler on a real site; the handler refuses too.
		expect(await site.call("helpful_member", { id: ids[0], helpful: true }, noAddress)).toMatchObject({ error: { code: "SIGN_IN_REQUIRED" } });
	});

	it("Insights says plainly when guest writes are off on this host", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		expect(await insightsJson(site)).toContain("Guests cannot vote on this host");
		const withAddress = JSON.stringify(
			await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST", meta: { ip: "203.0.113.9", userAgent: null, referer: null, geo: null } }),
		);
		expect(withAddress).not.toContain("Guests cannot vote on this host");
	});

	it("parallel first requests share one visitor salt", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		const visitor = guest("198.51.100.20");
		await Promise.all([0, 1, 2, 3, 4].map(() => site.call("helpful", { id: ids[0], helpful: false }, visitor)));
		// With a salt race each request would hash the visitor differently and count separately.
		expect(await site.call("tally", { id: ids[0] })).toMatchObject({ yes: 0, no: 1 });
	});
});

describe("search log (#41)", () => {
	it("a forged 'found' never hides an empty search", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		await site.call("log_search", { q: "refund policy", found: 0 }, guest("198.51.100.30"));
		await site.call("log_search", { q: "refund policy", found: 999 }, guest("198.51.100.31"));
		const page = await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST" });
		const tables = (page as { blocks: Array<{ type: string; page_action_id?: string; rows?: Array<Record<string, string>> }> }).blocks;
		const empty = tables.find((block) => block.page_action_id === "empty_page");
		expect(empty?.rows).toEqual([{ term: "refund policy", times: "1" }]);
		const top = tables.find((block) => block.page_action_id === "top_page");
		expect(top?.rows).toEqual([{ term: "refund policy", times: "2" }]);
		const card = JSON.stringify(await site.call("admin", { widget: "insights" }, { method: "POST" }));
		expect(card).toContain("1 search found nothing this week");
	});

	it("trims stale terms first, then the least searched, oldest of them first", async () => {
		const { trimSearchLog } = await import("../src/public");
		const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
		const rows = new Map<string, { count: number; lastAt: string }>();
		rows.set("stale busy", { count: 50, lastAt: day(60) });
		for (let i = 0; i < 3; i += 1) rows.set(`one-off ${i}`, { count: 1, lastAt: day(3 - i) });
		for (let i = 0; i < 8; i += 1) rows.set(`recent real ${i}`, { count: 5, lastAt: day(1) });
		const searches = {
			count: async () => rows.size,
			query: async ({ limit, orderBy }: { limit: number; orderBy: Record<string, string> }) => ({
				items: [...rows.entries()]
					.sort((x, y) => (orderBy.count ? x[1].count - y[1].count : x[1].lastAt.localeCompare(y[1].lastAt)))
					.slice(0, limit)
					.map(([id, data]) => ({ id, data })),
			}),
			deleteMany: async (ids: string[]) => ids.filter((id) => rows.delete(id)).length,
		};
		await trimSearchLog({ storage: { searches } } as never, 9);
		expect(rows.size).toBe(9);
		// The stale busy term went first, then the two oldest one-off terms. Recent real terms stayed.
		expect(rows.has("stale busy")).toBe(false);
		expect([...rows.keys()].filter((id) => id.startsWith("one-off"))).toEqual(["one-off 2"]);
		expect([...rows.keys()].filter((id) => id.startsWith("recent real"))).toHaveLength(8);
	});

	it("a log full of old busy terms still takes new terms", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		const { SEARCH_LOG_CAP } = await import("../src/public");
		for (let i = 0; i < SEARCH_LOG_CAP; i += 1) {
			await site.rt.fixtures.plugin.storage("searches", `old ${i}`, { term: `old ${i}`, count: 40, empty: 0, found: true, lastAt: "2025-01-01T00:00:00.000Z" });
		}
		await site.call("log_search", { q: "brand new term", found: 0 }, guest("198.51.100.50"));
		const page = await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST" });
		const blocks = (page as { blocks: Array<{ page_action_id?: string; rows?: Array<Record<string, string>> }> }).blocks;
		expect(blocks.find((block) => block.page_action_id === "empty_page")?.rows).toEqual([{ term: "brand new term", times: "1" }]);
	}, 240_000);

	it("a flood of made-up one-off terms never pushes out recent terms with real traffic", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		const { SEARCH_LOG_CAP } = await import("../src/public");
		const recent = new Date(Date.now() - 86_400_000).toISOString();
		for (let i = 0; i < SEARCH_LOG_CAP; i += 1) {
			await site.rt.fixtures.plugin.storage("searches", `real ${i}`, { term: `real ${i}`, count: 3, empty: 0, found: true, lastAt: recent });
		}
		// Junk from many addresses, so the per-guest limit does not stop it first.
		for (let i = 0; i < 30; i += 1) {
			await site.call("log_search", { q: `junk term ${i}`, found: 0 }, guest(`198.51.100.${i + 1}`));
		}
		const load = async () =>
			((await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST" })) as {
				blocks: Array<{ page_action_id?: string; rows?: Array<Record<string, string>> }>;
			}).blocks;
		// Every junk term was dropped on arrival: each real term has more traffic.
		expect((await load()).find((block) => block.page_action_id === "empty_page")?.rows).toBeUndefined();
		// A real term was never evicted: logging it again adds to its count (3 + 1).
		await site.call("log_search", { q: "real 0", found: 1 }, guest("203.0.113.200"));
		const top = (await load()).find((block) => block.page_action_id === "top_page")?.rows || [];
		expect(top.find((row) => row.term === "real 0")?.times).toBe("4");
		expect(top.filter((row) => row.term.startsWith("junk"))).toEqual([]);
	}, 240_000);

	it("never stores a phone number in any spacing, or an email address", () => {
		expect(skipSearchTerm("555-123-4567")).toBe(true);
		expect(skipSearchTerm("(555) 123 4567")).toBe(true);
		expect(skipSearchTerm("+44 20.7946.0958")).toBe(true);
		expect(skipSearchTerm("4111 1111 1111 1111")).toBe(true);
		expect(skipSearchTerm("me@example.com")).toBe(true);
		expect(skipSearchTerm("windows 10 build 19045")).toBe(false);
		expect(skipSearchTerm("reset password")).toBe(false);
	});

	it("refuses a contact link that leaves the site through a backslash", () => {
		expect(parseContactUrl("/\\evil.example")).toEqual({ ok: false });
		expect(parseContactUrl("/contact\\x")).toEqual({ ok: false });
		expect(parseContactUrl("//evil.example")).toEqual({ ok: false });
		expect(parseContactUrl("/contact")).toEqual({ ok: true, value: "/contact" });
	});
});

describe("first admin screen (#43, starter #2)", () => {
	it("shows the visitor pages card with this version's command until the owner says done", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const page = await insightsJson(site);
		expect(page).toContain("Set up visitor pages");
		const code = (JSON.parse(page).blocks as Array<{ type: string; code?: string }>).find((block) => block.type === "code")?.code;
		expect(code).toMatch(/^kit="\$\(mktemp -d\)" && git clone --branch v\d+\.\d+\.\d+ --depth 1 https:\/\/github.com\/wbcomdesigns\/emdash-knowx "\$kit\/emdash-knowx" && "\$kit\/emdash-knowx\/scripts\/add-to-site.sh" \.$/);
		expect(page).not.toContain("/tmp/emdash-knowx");
		expect(page).toContain("/docs/faq/");
		expect(page).not.toContain("blob/main");
		expect(page).toContain("Content, Help articles");
		expect(page).toContain("Content, FAQs");
		const done = JSON.stringify(await site.call("admin", { type: "block_action", action_id: "kit_done", page: "/insights" }, { method: "POST" }));
		expect(done).not.toContain("Set up visitor pages");
		expect(done).toContain("Install guide");
		expect(await insightsJson(site)).not.toContain("Set up visitor pages");
	});

	it("names where to add the first help article and FAQ once the content types exist", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		const page = await insightsJson(site);
		expect(page).toContain("Content, Help articles");
		expect(page).toContain("Content, FAQs");
	});
});
