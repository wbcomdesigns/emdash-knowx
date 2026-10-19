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
			error: { code: "VALIDATION_ERROR", reason: "GUEST_UNAVAILABLE" },
		});
		expect(await site.call("log_search", { q: "invented term", found: 0 }, noAddress)).toMatchObject({
			ok: false,
			error: { code: "VALIDATION_ERROR", reason: "GUEST_UNAVAILABLE" },
		});
		// "unknown" is what some proxies send, and garbage cannot be parsed: both count as no address.
		expect(await site.call("helpful", { id: ids[0], helpful: true }, guest("not-an-ip"))).toMatchObject({
			error: { code: "VALIDATION_ERROR", reason: "GUEST_UNAVAILABLE" },
		});
		expect(await site.call("helpful", { id: ids[0], helpful: true }, guest("unknown"))).toMatchObject({
			error: { code: "VALIDATION_ERROR", reason: "GUEST_UNAVAILABLE" },
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

	it("the kit's member check stores nothing: a member gets VALIDATION_ERROR, a guest SIGN_IN_REQUIRED (#45)", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		expect(await site.call("helpful_member", {}, asMember())).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
		expect(await site.call("helpful_member", {}, noAddress)).toMatchObject({ ok: false, error: { code: "SIGN_IN_REQUIRED" } });
		expect(await site.call("tally", { id: ids[0] })).toMatchObject({ yes: 0, no: 0 });
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

	it("on the real host, the trim goes stale first, then least searched oldest first, never by name", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		const { SEARCH_LOG_CAP } = await import("../src/public");
		const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
		const put = (term: string, count: number, lastAt: string) =>
			site.rt.fixtures.plugin.storage("searches", term, { term, count, empty: 0, found: true, lastAt });
		// Busy recent terms fill most of the log. Names sort both before and after the one-offs.
		for (let i = 0; i < SEARCH_LOG_CAP - 4; i += 1) await put(`busy ${String(i).padStart(4, "0")}`, 5, ago(1));
		await put("zzz stale busy", 50, ago(60)); // stale: goes first despite its count and late name
		await put("zzz old one-off", 1, ago(10)); // the oldest one-off: goes next despite its late name
		await put("aaa newer one-off", 1, ago(2)); // a newer one-off with an early name: stays
		await put("mmm newest one-off", 1, ago(1));
		const exists = async (term: string) => {
			const blocks = (await site.call("admin", { type: "form_submit", action_id: "top_find", page: "/insights", values: { find: term } }, { method: "POST" })) as {
				blocks: Array<{ page_action_id?: string; rows?: Array<Record<string, string>> }>;
			};
			return Boolean(blocks.blocks.find((block) => block.page_action_id === "top_page")?.rows?.some((row) => row.term === term));
		};
		await site.call("log_search", { q: "new term one", found: 1 }, guest("198.51.100.60"));
		expect(await exists("zzz stale busy")).toBe(false);
		expect(await exists("zzz old one-off")).toBe(true);
		await site.call("log_search", { q: "new term two", found: 1 }, guest("198.51.100.61"));
		expect(await exists("zzz old one-off")).toBe(false);
		expect(await exists("aaa newer one-off")).toBe(true);
		expect(await exists("busy 0000")).toBe(true);
	}, 300_000);

	it("a flood of made-up one-off terms never pushes out recent terms with real traffic", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		const { SEARCH_LOG_CAP } = await import("../src/public");
		const recent = new Date(Date.now() - 86_400_000).toISOString();
		for (let i = 0; i < SEARCH_LOG_CAP; i += 1) {
			await site.rt.fixtures.plugin.storage("searches", `real ${i}`, { term: `real ${i}`, count: 3, empty: 0, found: true, lastAt: recent });
		}
		for (let i = 0; i < 30; i += 1) await site.call("log_search", { q: `junk term ${i}`, found: 0 }, guest(`198.51.100.${i + 1}`));
		const find = async (term: string) =>
			((await site.call("admin", { type: "form_submit", action_id: "top_find", page: "/insights", values: { find: term } }, { method: "POST" })) as {
				blocks: Array<{ page_action_id?: string; rows?: Array<Record<string, string>> }>;
			}).blocks.find((block) => block.page_action_id === "top_page")?.rows || [];
		expect(await find("junk")).toEqual([]);
		await site.call("log_search", { q: "real 4999", found: 1 }, guest("203.0.113.200"));
		expect((await find("real 4999")).find((row) => row.term === "real 4999")?.times).toBe("4");
	}, 300_000);

	it("empty searches stay on Insights behind 4800 busy terms, and the week counts every search", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		await site.call("log_search", { q: "refund policy", found: 0 }, guest("198.51.100.70"));
		await site.call("log_search", { q: "export to csv", found: 0 }, guest("198.51.100.71"));
		const later = new Date(Date.now() + 60_000).toISOString();
		// 4800 busy terms keep the log under its 5000 cap, so nothing is trimmed: what is tested is
		// that Insights reads past the 100 rows one storage query returns.
		for (let i = 0; i < 4800; i += 1) {
			await site.rt.fixtures.plugin.storage("searches", `busy ${i}`, { term: `busy ${i}`, count: 9, empty: 0, found: true, lastAt: later });
		}
		for (let i = 0; i < 120; i += 1) await site.call("log_search", { q: `found ${i}`, found: 2 }, guest(`203.0.113.${(i % 200) + 1}`));
		const page = (await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST" })) as {
			blocks: Array<Record<string, unknown>>;
		};
		const empty = page.blocks.find((block) => block.page_action_id === "empty_page") as { rows: Array<Record<string, string>> } | undefined;
		expect(JSON.stringify(page.blocks.slice(-6))).toContain("empty_page");
		expect(empty?.rows.map((row) => row.term).sort()).toEqual(["export to csv", "refund policy"]);
		const text = JSON.stringify(page);
		expect(text).toContain('"label":"Searches this week","value":"122"');
		expect(text).toContain('"label":"Searches with no results","value":"2"');
		const card = JSON.stringify(await site.call("admin", { widget: "insights" }, { method: "POST" }));
		expect(card).toContain("2 searches found nothing this week");
	}, 300_000);

	it("counts every search of 40 parallel visitors in the week total", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		const results = await Promise.all(
			Array.from({ length: 40 }, (_, i) => site.call("log_search", { q: `burst ${i}`, found: i % 2 }, guest(`198.51.100.${i + 1}`))),
		);
		expect(results.every((result) => (result as { ok?: boolean }).ok)).toBe(true);
		const page = JSON.stringify(await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST" }));
		expect(page).toContain('"label":"Searches this week","value":"40"');
		expect(page).toContain('"label":"Searches with no results","value":"20"');
	}, 120_000);

	it("Top searches pages forward, back and to the first page", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		for (let i = 0; i < 60; i += 1) {
			await site.rt.fixtures.plugin.storage("searches", `t${String(i).padStart(2, "0")}`, { term: `t${String(i).padStart(2, "0")}`, count: 100 - i, empty: 0, found: true, lastAt: new Date().toISOString() });
		}
		type Page = { blocks: Array<{ page_action_id?: string; next_cursor?: string; rows?: Array<Record<string, string>>; elements?: Array<{ action_id?: string }> }> };
		const first = (await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST" })) as Page;
		const table = (page: Page) => page.blocks.find((block) => block.page_action_id === "top_page");
		const firstRows = table(first)?.rows?.map((row) => row.term);
		expect(firstRows?.[0]).toBe("t00");
		const two = (await site.call("admin", { type: "block_action", action_id: "top_page", page: "/insights", value: { cursor: table(first)?.next_cursor } }, { method: "POST" })) as Page;
		expect(table(two)?.rows?.[0].term).toBe("t25");
		expect(JSON.stringify(two)).toContain('"action_id":"top_prev"');
		const three = (await site.call("admin", { type: "block_action", action_id: "top_page", page: "/insights", value: { cursor: table(two)?.next_cursor } }, { method: "POST" })) as Page;
		expect(table(three)?.rows?.[0].term).toBe("t50");
		const back = (await site.call("admin", { type: "block_action", action_id: "top_prev", page: "/insights" }, { method: "POST" })) as Page;
		expect(table(back)?.rows?.[0].term).toBe("t25");
		const reset = (await site.call("admin", { type: "block_action", action_id: "top_first", page: "/insights" }, { method: "POST" })) as Page;
		expect(table(reset)?.rows?.map((row) => row.term)).toEqual(firstRows);
		expect(JSON.stringify(reset)).not.toContain('"action_id":"top_prev"');
	});

	it("reopening Insights starts Top searches again at page 1 with no find text", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		for (let i = 0; i < 80; i += 1) {
			const term = `${i < 10 ? "ab" : "zz"}${String(i).padStart(2, "0")}`;
			await site.rt.fixtures.plugin.storage("searches", term, { term, count: 200 - i, empty: 0, found: true, lastAt: new Date().toISOString() });
		}
		type Page = { blocks: Array<{ type?: string; text?: string; page_action_id?: string; next_cursor?: string; rows?: Array<Record<string, string>> }> };
		const call = async (input: Record<string, unknown>) => (await site.call("admin", { page: "/insights", ...input }, { method: "POST" })) as Page;
		const table = (page: Page) => page.blocks.find((block) => block.page_action_id === "top_page");
		const more = async (page: Page) => call({ type: "block_action", action_id: "top_page", value: { cursor: table(page)?.next_cursor } });
		const label = (page: Page) => page.blocks.find((block) => block.type === "context" && /at a time/.test(block.text || ""))?.text || "";

		let page = await call({ type: "page_load" });
		page = await more(page);
		page = await more(page);
		expect(label(page)).toContain("Page 3.");
		const reopened = await call({ type: "page_load" });
		const two = await more(reopened);
		expect(label(two)).toContain("Page 2.");
		expect(table(two)?.rows?.[0].term).toBe("zz25");
		const back = await call({ type: "block_action", action_id: "top_prev" });
		expect(table(back)?.rows?.[0].term).toBe("ab00");

		const found = await call({ type: "form_submit", action_id: "top_find", values: { find: "ab" } });
		expect(table(found)?.rows).toHaveLength(10);
		const fresh = await call({ type: "page_load" });
		const unfiltered = await more(fresh);
		expect(table(unfiltered)?.rows?.[0].term).toBe("zz25");
		expect(label(unfiltered)).toContain("80 terms");
	});

	it("never serves a contact link saved before the stricter check", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.setting("contact_url", "/\t/evil.example");
		expect(await site.call("config")).toMatchObject({ ok: true, contactUrl: "" });
		await site.rt.fixtures.plugin.setting("contact_url", "/contact");
		expect(await site.call("config")).toMatchObject({ contactUrl: "/contact" });
	});

	it("refuses a search log body that is too large", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const big = await site.call("log_search", { q: "x", found: 0, pad: "a".repeat(5000) }, guest("198.51.100.80"));
		expect(big).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
	});

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
		expect(parseContactUrl("/\t/evil.example")).toEqual({ ok: false });
		expect(parseContactUrl("/\n/evil.example")).toEqual({ ok: false });
		expect(parseContactUrl("/contact\r\n")).toEqual({ ok: false });
		expect(parseContactUrl("/con\x7ftact")).toEqual({ ok: false });
		expect(parseContactUrl("/contact")).toEqual({ ok: true, value: "/contact" });
	});
});

describe("first admin screen (#43, starter #2)", () => {
	it("shows the visitor pages card with this version's command until the owner says done", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const page = await insightsJson(site);
		expect(page).toContain("Set up visitor pages");
		const code = (JSON.parse(page).blocks as Array<{ type: string; code?: string }>).find((block) => block.type === "code")?.code || "";
		const lines = code.split("\n");
		expect(lines).toHaveLength(6);
		for (const line of lines) expect(line.length).toBeLessThanOrEqual(52);
		expect(lines[0]).toBe('kit="$(mktemp -d)" &&');
		expect(code).toMatch(/--branch v\d+\.\d+\.\d+ \\/);
		expect(page).toContain("Copy it from the install guide on a phone");
		expect(page).not.toContain("/tmp/emdash-knowx");
		expect(page).toContain("/docs/faq/");
		// #46: the addresses are wrapping text, not a fields block that clips at 390.
		const blocks = JSON.parse(page).blocks as Array<{ type: string; text?: string }>;
		expect(blocks.some((block) => block.type === "fields")).toBe(false);
		expect(blocks.find((block) => block.type === "section" && block.text?.includes("/docs/category/<topic>/"))).toBeTruthy();
		expect(page).not.toContain("blob/main");
		expect(page).toContain("Content, Help articles");
		expect(page).toContain("Content, FAQs");
		const done = JSON.stringify(await site.call("admin", { type: "block_action", action_id: "kit_done", page: "/insights" }, { method: "POST" }));
		expect(done).not.toContain("Set up visitor pages");
		expect(done).toContain("Install guide");
		expect(await insightsJson(site)).not.toContain("Set up visitor pages");
		const again = JSON.stringify(await site.call("admin", { type: "block_action", action_id: "kit_show", page: "/insights" }, { method: "POST" }));
		expect(again).toContain("Set up visitor pages");
	});

	// CSS is left out: the test runner hands ?raw CSS back processed, so its bytes differ.
	it("kit.sums lists the hash of every kit script, part and page in this version", async () => {
		// @ts-expect-error vite raw import
		const sums = new Set(String((await import("../site-kit/kit.sums?raw")).default).trim().split("\n"));
		const files = (import.meta as unknown as { glob: (p: string[], o: object) => unknown }).glob(["../site-kit/{lib,components,layouts}/*.{ts,astro}", "../site-kit/pages/**/*.astro"], {
			query: "?raw",
			import: "default",
			eager: true,
		}) as Record<string, string>;
		const hex = async (text: string) =>
			[...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
		let checked = 0;
		for (const [file, text] of Object.entries(files)) {
			const rel = file.replace("../site-kit/", "");
			if (/wbcom-(kit\.ts|base\.css)$/.test(rel)) continue;
			expect(sums.has(`${await hex(text)}  ${rel}`), `${rel} is not in kit.sums: run scripts/make-kit-sums.sh`).toBe(true);
			checked += 1;
		}
		expect(checked).toBeGreaterThan(10);
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
