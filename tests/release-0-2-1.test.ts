import { afterEach, describe, expect, it } from "vitest";

import { openSite, withDocs } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

type Site = Awaited<ReturnType<typeof openSite>>;
const admin = (site: Site, input: Record<string, unknown>) => site.call("admin", input, { method: "POST" });
const text = (value: unknown) => JSON.stringify(value);
const full = (value: unknown) => String(text(value)).includes('"label":"Helpful rate"');
const day = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);

/** The Node lab's 0.1.5 data (#52): one article with one No vote, a few searches over two days, no comments. */
async function smallSeed(site: Site, days = true) {
	const { ids } = await withDocs(site.rt, [{ title: "Alpha" }, { title: "Beta" }]);
	const a = ids[0]!;
	await site.rt.fixtures.plugin.storage("feedback", `${a}:v1`, {
		doc: a,
		doc_helpful: `${a}:no`,
		helpful: false,
		comment: "",
		visitor: "v1",
		createdAt: new Date(Date.now() - 86_400_000).toISOString(),
	});
	const lastAt = new Date().toISOString();
	await site.rt.fixtures.plugin.storage("searches", "install", { term: "install", count: 2, empty: 0, found: true, lastAt });
	await site.rt.fixtures.plugin.storage("searches", "refund", { term: "refund", count: 1, empty: 1, found: false, lastAt, lastEmptyAt: lastAt });
	if (days) await site.rt.fixtures.plugin.kv(`day:${day(1)}`, "1|0");
	if (days) await site.rt.fixtures.plugin.kv(`day:${day(0)}`, "2|1");
	return a;
}

describe("updating a small 0.1.5 site (#52)", () => {
	for (const days of [true, false]) {
		it(`every Insights load shows the upgrade card until it is done, never an empty state (${days ? "with" : "no"} search day counters)`, async () => {
			const site = await openSite();
			dispose = site.dispose;
			await smallSeed(site, days);
			let page: unknown;
			for (let i = 0; i < 10 && !full(page); i += 1) {
				const finished = (await site.rt.inspect.setting("upgrade_0_2")) as { done?: boolean } | null;
				page = await admin(site, { type: "page_load", page: "/insights" });
				if (finished?.done) break;
				// Until the upgrade is done: the progress card (or its last "ready" card), never the page.
				const body = text(page);
				expect(body, `load ${i + 1}`).not.toContain("None yet");
				expect(body, `load ${i + 1}`).not.toContain("No weak articles yet");
				expect(body, `load ${i + 1}`).toMatch(/Bringing over data from KnowX 0.1|Insights is ready/);
			}
			expect(full(page)).toBe(true);
			const body = text(page);
			// What 0.1.5 showed: one No vote (0% helpful), Alpha the weakest article.
			expect(body).toContain('"label":"Helpful rate","value":"0%"');
			expect(body).toContain('"article":"Alpha","no":"1","yes":"0"');
			if (days) {
				expect(body).toContain('"label":"Searches this week","value":"3"');
				expect(body).toContain('"label":"Searches with no results","value":"1"');
			}
			expect(await site.rt.inspect.setting("upgrade_0_2")).toEqual({ done: true });
		});
	}

	it("a site that began the upgrade on 0.2.0 carries on from where it was", async () => {
		const site = await openSite();
		dispose = site.dispose;
		// 0.2.0 merged (and removed) the day counters on its first load; there is no `started` setting yet.
		await smallSeed(site, false);
		await site.rt.fixtures.plugin.kv("state:upgrade_0_2", { days: true, votes: false, titles: false, after: "", counted: 0, titleCursor: "" });
		let page: unknown;
		for (let i = 0; i < 10 && !full(page); i += 1) {
			page = await admin(site, { type: "page_load", page: "/insights" });
			expect(text(page)).not.toContain("None yet");
		}
		expect(text(page)).toContain('"label":"Helpful rate","value":"0%"');
	});
});

describe("a Yes or No click before the kit script binds (#51)", () => {
	it("is kept by an inline script and sent once the kit script binds", async () => {
		// @ts-expect-error vite raw import
		const raw = String((await import("../site-kit/components/Helpful.astro?raw")).default);
		const early = raw.slice(raw.indexOf("<script is:inline>"), raw.indexOf("</script>", raw.indexOf("<script is:inline>")));
		expect(early).toContain("if (!root || root.dataset.kxReady) return;");
		expect(early).toContain("root.dataset.kxQueued = button.dataset.kxVote;");
		const kit = raw.slice(raw.indexOf("<script>\n"));
		// Marked ready only after the buttons are wired, then the kept click is sent once.
		const wired = kit.indexOf('button.addEventListener("click"');
		const ready = kit.indexOf('root.dataset.kxReady = "1";');
		expect(wired).toBeGreaterThan(0);
		expect(ready).toBeGreaterThan(wired);
		expect(kit.slice(ready)).toMatch(/delete root\.dataset\.kxQueued;\n\t\tif \(queued\) void vote\(queued\.dataset\.kxVote === "yes", queued\);/);
	});
});
