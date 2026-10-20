import { afterEach, describe, expect, it } from "vitest";

import { statsOf, withLegacyDays } from "../src/stats";
import { ana, guest, openSite, withDocs } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

type Site = Awaited<ReturnType<typeof openSite>>;
const admin = (site: Site, input: Record<string, unknown>) => site.call("admin", input, { method: "POST" });
const text = (value: unknown) => JSON.stringify(value);
const full = (value: unknown) => String(text(value)).includes('"label":"Helpful rate"');

/** A 0.1.5 vote row: no `commented`, no `title`, no stored counts. */
const oldVote = (doc: string, who: string, helpful: boolean, comment = "") => ({
	doc,
	doc_helpful: `${doc}:${helpful ? "yes" : "no"}`,
	helpful,
	comment,
	visitor: who,
	createdAt: new Date(Date.now() - 3600_000).toISOString(),
});

describe("0.1.5 data on the 0.2.0 engine (#48)", () => {
	it("counts old votes once, even when an article is read and voted on halfway through", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Alpha" }, { title: "Beta" }, { title: "Gamma" }]);
		const [a, b, c] = ids as [string, string, string];
		// Alpha: 1 yes 3 no (weak, one comment). Beta: 2 yes 1 no (one comment). Gamma: 1 no.
		await site.rt.fixtures.plugin.storage("feedback", `${a}:v1`, oldVote(a, "v1", true));
		await site.rt.fixtures.plugin.storage("feedback", `${a}:v2`, oldVote(a, "v2", false, "Too short"));
		await site.rt.fixtures.plugin.storage("feedback", `${a}:v3`, oldVote(a, "v3", false));
		await site.rt.fixtures.plugin.storage("feedback", `${a}:v4`, oldVote(a, "v4", false));
		await site.rt.fixtures.plugin.storage("feedback", `${b}:v1`, oldVote(b, "v1", true));
		await site.rt.fixtures.plugin.storage("feedback", `${b}:v2`, oldVote(b, "v2", true));
		await site.rt.fixtures.plugin.storage("feedback", `${b}:v3`, oldVote(b, "v3", false, "Old on Beta"));
		await site.rt.fixtures.plugin.storage("feedback", `${c}:v1`, oldVote(c, "v1", false));
		const today = new Date().toISOString().slice(0, 10);
		await site.rt.fixtures.plugin.kv(`day:${today}`, "7|2");

		// A visitor opens Beta before the owner opens Insights: tally counts it from its rows.
		expect(await site.call("tally", { id: b })).toMatchObject({ ok: true, yes: 2, no: 1 });
		// The 0.1.5 kit flow: read the counts, ask the member route, then vote as a guest.
		expect(await site.call("helpful", { id: b, helpful: false, comment: "Changed" }, guest("198.51.100.9"))).toMatchObject({ ok: true, yes: 2, no: 2 });

		let page: unknown;
		for (let i = 0; i < 10 && !full(page); i += 1) page = await admin(site, { type: "page_load", page: "/insights" });
		expect(full(page)).toBe(true);
		const body = text(page);
		// 3 yes and 6 no over the three articles: 33%.
		expect(body).toContain('"label":"Helpful rate","value":"33%"');
		expect(body).toContain('"label":"Searches this week","value":"7"');
		expect(body).toContain('"label":"Searches with no results","value":"2"');
		expect(body).toContain('"article":"Alpha","no":"3","yes":"1"');
		expect(body).toContain('"article":"Gamma","no":"1","yes":"0"');
		expect(body).toContain('"article":"Alpha","comment":"Too short"');
		expect(body).toContain('"article":"Beta","comment":"Changed"');
		// An old comment on an article tally counted before the upgrade reached it is still listed.
		expect(body).toContain('"article":"Beta","comment":"Old on Beta"');
		expect(await site.call("tally", { id: a })).toMatchObject({ yes: 1, no: 3 });
		expect(await site.call("tally", { id: b })).toMatchObject({ yes: 2, no: 2 });

		// A 0.1.5 voter changes their old vote: moved, never counted twice.
		const old = await site.rt.inspect.storage.get<Record<string, unknown>>("feedback", `${a}:v2`);
		expect(old).toMatchObject({ commented: expect.any(String) });
		await site.call("helpful_member", { id: c, helpful: true }, { method: "POST", user: ana });
		expect(await site.call("tally", { id: c })).toMatchObject({ yes: 1, no: 1 });
		const after = text(await admin(site, { type: "page_load", page: "/insights" }));
		expect(after).toContain('"label":"Helpful rate","value":"40%"');
	});

	it("a new site shows the full Insights page on every load, and the upgrade finishes", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Alpha" }]);
		for (let i = 0; i < 3; i += 1) expect(full(await admin(site, { type: "page_load", page: "/insights" }))).toBe(true);
		expect(await site.rt.inspect.setting("upgrade_0_2")).toEqual({ done: true });
	});

	it("two steps at once (double click, two tabs) count old votes and days once", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Alpha" }, { title: "Beta" }]);
		const [a, b] = ids as [string, string];
		await site.rt.fixtures.plugin.storage("feedback", `${a}:v1`, oldVote(a, "v1", true));
		await site.rt.fixtures.plugin.storage("feedback", `${a}:v2`, oldVote(a, "v2", false, "Too short"));
		await site.rt.fixtures.plugin.storage("feedback", `${b}:v1`, oldVote(b, "v1", false));
		const today = new Date().toISOString().slice(0, 10);
		await site.rt.fixtures.plugin.kv(`day:${today}`, "7|2");

		let pages: unknown[] = [];
		for (let i = 0; i < 10 && !pages.some(full); i += 1) {
			pages = await Promise.all([admin(site, { type: "page_load", page: "/insights" }), admin(site, { type: "block_action", action_id: "upgrade_step", page: "/insights" })]);
		}
		const body = text(await admin(site, { type: "page_load", page: "/insights" }));
		// 1 yes and 2 no: 33%, not doubled; 7 searches from 0.1.5, merged once.
		expect(body).toContain('"label":"Helpful rate","value":"33%"');
		expect(body).toContain('"label":"Searches this week","value":"7"');
		expect(await site.rt.inspect.storage.get("stats", "site")).toMatchObject({ yes: 1, no: 2 });
		// The merged day counter is removed once the merge is stored.
		expect(await site.rt.inspect.kv.get(`day:${today}`)).toBeNull();
		expect(await site.call("tally", { id: a })).toMatchObject({ yes: 1, no: 1 });
		expect(await site.rt.inspect.setting("upgrade_0_2")).toEqual({ done: true });
	});
});

describe("articles that are gone from Least helpful (#49)", () => {
	it("skips counts with no title (trashed or unpublished) and still lists 10", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, Array.from({ length: 11 }, (_, i) => ({ title: `Kept ${i}` })));
		await site.rt.fixtures.plugin.setting("upgrade_0_2", { done: true });
		for (const [i, id] of ids.entries()) await site.rt.fixtures.plugin.storage("article_votes", id, { doc: id, yes: 0, no: 20 - i, net: 20 - i, title: `Kept ${i}`, titledAt: "" });
		// Counted from 0.1.x, then trashed before the upgrade named them: the most No votes of all.
		for (const gone of ["gone-1", "gone-2", "gone-3"]) await site.rt.fixtures.plugin.storage("article_votes", gone, { doc: gone, yes: 0, no: 99, net: 99, title: "", titledAt: "" });
		const page = await admin(site, { type: "page_load", page: "/insights" });
		const weak = (page as { blocks: Array<{ page_action_id?: string; rows?: Array<{ article: string }> }> }).blocks.find((block) => block.page_action_id === "weak_page");
		expect(weak?.rows?.map((row) => row.article)).toEqual(Array.from({ length: 10 }, (_, i) => `Kept ${i}`));
		const widget = text(await admin(site, { type: "page_load", page: "widget:insights" }));
		expect(widget).toContain("Least helpful article: Kept 0.");
		expect(widget).not.toContain("Help article");
	});
});

describe("votes need a published article (#48)", () => {
	it("refuses a vote on a draft, even one with stored counts, and stores nothing", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Hidden", status: "draft" }]);
		const id = ids[0]!;
		await site.rt.fixtures.plugin.storage("article_votes", id, { doc: id, yes: 0, no: 0, net: 0, title: "Hidden", titledAt: "" });
		expect(await site.call("helpful", { id, helpful: false, comment: "x" }, guest("198.51.100.40"))).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
		expect(await site.call("helpful_member", { id, helpful: true }, { method: "POST", user: ana })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
		expect(await site.rt.inspect.storage.list("feedback")).toHaveLength(0);
		expect(await site.rt.inspect.storage.get("article_votes", id)).toMatchObject({ yes: 0, no: 0 });
	});
});

describe("Insights setup card on Cloudflare (#48)", () => {
	it("never says the command creates the content types on every host", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const page = text(await admin(site, { type: "page_load", page: "/insights" }));
		expect(page).not.toContain("and creates the Help articles and FAQs content types");
		expect(page).toContain("On a site whose database is a local SQLite file it also creates the Help articles and FAQs content types");
		expect(page).toContain("create them in the admin as the install guide shows");
		expect(page).not.toContain("The kit command above creates");
	});

	it("Visitor pages are set up is stored for this version and survives a reload", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Alpha" }]);
		await admin(site, { type: "block_action", action_id: "kit_done", page: "/insights" });
		expect(text(await admin(site, { type: "page_load", page: "/insights" }))).not.toContain("Set up visitor pages");
		// An older version's "done" (0.1.5 kept "1" in kv) shows the card again: copy the new kit.
		await site.rt.fixtures.plugin.setting("kit_pages_done", "0.1.5");
		expect(text(await admin(site, { type: "page_load", page: "/insights" }))).toContain("Set up visitor pages");
	});
});

describe("site counters", () => {
	it("adds 0.1.x day counters into the ring, and drops days older than it", () => {
		const now = Date.parse("2026-10-20T12:00:00Z");
		const row = withLegacyDays(null, [
			{ key: "day:2026-10-20", value: "5|1" },
			{ key: "day:2026-10-14", value: "3|0" },
			{ key: "day:2026-09-01", value: "99|9" },
			{ key: "day:junk", value: "1|1" },
		], now);
		const stats = statsOf(row, 14, now);
		expect(stats.days.at(-1)).toMatchObject({ searches: 5, empty: 1 });
		expect(stats.days.at(-7)).toMatchObject({ searches: 3, empty: 0 });
		expect(stats.days.reduce((sum, day) => sum + day.searches, 0)).toBe(8);
	});
});
