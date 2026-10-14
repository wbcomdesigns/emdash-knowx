import { describe, expect, it } from "vitest";

import { resultSnippet, snippetPlain } from "../site-kit/lib/knowx";
import { kx } from "../site-kit/lib/knowx-strings";

describe("search result line", () => {
	it("hides a snippet that only repeats the title", () => {
		expect(resultSnippet("Welcome to the help center", "Welcome to the help center")).toBe("");
		expect(resultSnippet("Welcome to the help center", "<mark>Welcome</mark> to the help center")).toBe("");
	});

	it("keeps marked HTML when the snippet adds article words", () => {
		const snippet = "<mark>Welcome</mark> readers start here and find a topic.";
		expect(resultSnippet("Welcome to the help center", snippet)).toBe(snippet);
		expect(snippetPlain(snippet)).toBe("Welcome readers start here and find a topic.");
	});

	it("treats an empty or missing snippet as no line", () => {
		expect(resultSnippet("Invite your team")).toBe("");
		expect(resultSnippet("Invite your team", "   ")).toBe("");
	});

	it("caps a long search heading at 100 characters", () => {
		const q = "a".repeat(400);
		const heading = kx.searchResultsFor(q);
		expect(heading.length).toBeLessThan(130);
		expect(heading).toContain("…");
	});
});
