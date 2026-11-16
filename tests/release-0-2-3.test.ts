import { afterEach, describe, expect, it } from "vitest";

import { kitCommand } from "../src/admin";
import { admin, ana, member, openSite, withDocs } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

const text = (value: unknown) => JSON.stringify(value);

describe("0.2.3", () => {
	// #63: EmDash lists KnowX's admin pages to every signed-in role. Below admin they get a plain
	// page, never a raw 403, and nothing is read or written for them.
	it("a subscriber or editor opening any KnowX admin page gets the admins-only page and changes nothing", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Add a page" }]);
		const editor = member("eve", 40);
		for (const user of [ana, editor]) {
			for (const input of [
				{ type: "page_load", page: "/insights" },
				{ type: "page_load", page: "/searches" },
				{ type: "page_load", page: "/settings" },
				{ type: "page_load", page: "widget:insights" },
				{ type: "block_action", page: "/insights", action_id: "kit_done" },
				{ type: "form_submit", page: "/settings", action_id: "save_contact", values: { contact_url: "https://evil.test" } },
			]) {
				const result = await site.call("admin", input, { method: "POST", user });
				expect(text(result), `${user.id} ${input.type} ${input.page}`).toContain("Only site admins can use KnowX");
				expect(text(result)).not.toContain("FORBIDDEN");
			}
		}
		expect(await site.rt.inspect.setting("contact_url")).toBeFalsy();
		expect(await site.rt.inspect.setting("kit_pages_done")).toBeFalsy();
		// The admin still gets the real page.
		const own = await site.call("admin", { type: "page_load", page: "/insights" }, { method: "POST", user: admin });
		expect(text(own)).toContain("Insights");
		expect(text(own)).not.toContain("Only site admins");
	});

	it("the kit command clones the tag without git's detached-head notice, six lines of 52 or fewer", () => {
		const lines = kitCommand("v0.2.3").split("\n");
		expect(lines).toHaveLength(6);
		for (const line of lines) expect(line.length).toBeLessThanOrEqual(52);
		expect(lines[1]).toBe("  git -c advice.detachedHead=false \\");
		expect(lines[2]).toBe("    clone --depth 1 --branch v0.2.3 \\");
	});
});

// The kit pages are Astro files the site renders; the browser walk proves them. These checks pin
// each fix in the source so a later edit cannot quietly undo it (each fails on the 0.2.2 kit).
describe("0.2.3 kit", () => {
	const read = async (path: string) => String((await import(`../site-kit/${path}?raw`)).default);

	it("#64: the help home pages through every article instead of a fixed slice of 8", async () => {
		const home = await read("pages/docs/index.astro");
		expect(home).not.toMatch(/slice\(0, 8\)/);
		expect(home).toMatch(/cursor: after/);
		expect(home).toContain("kx.moreArticles");
	});

	it("search results page on past 20, and only the first page is logged", async () => {
		const search = await read("pages/docs/search.astro");
		expect(search).toMatch(/cursor: after/);
		expect(search).toContain("kx.moreResults");
		expect(search).toMatch(/const log = q && !after/);
	});

	it("#65: On this page comes before the article in the markup; #67: copy buttons name their heading", async () => {
		const article = await read("pages/docs/[...slug].astro");
		expect(article.indexOf('<aside class="kx-toc">')).toBeGreaterThan(0);
		expect(article.indexOf('<aside class="kx-toc">')).toBeLessThan(article.indexOf('<article class="kx-article">'));
		expect(article).toMatch(/const name = heading\.textContent/);
		expect(article).toMatch(/"Copy link"\}: \$\{name\}/);
	});

	it("#66: a counted vote is remembered in the browser and marked on load", async () => {
		const helpful = await read("components/Helpful.astro");
		expect(helpful).toMatch(/saveVote\(id, helpful\)/);
		expect(helpful).toMatch(/if \(earlier !== null\) markChoice\(root, earlier\)/);
	});
});
