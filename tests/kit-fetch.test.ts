import { afterEach, describe, expect, it, vi } from "vitest";

import { pluginFetch, registryPluginId } from "../site-kit/lib/wbcom-kit";

const missing = () =>
	new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Plugin route not found" } }), { status: 404 });
const ok = () => new Response(JSON.stringify({ success: true, data: { ok: true, version: "0.1.1" } }), { status: 200 });

// Each case loads a fresh copy of the kit, so what one case remembered cannot leak into the next.
async function fresh() {
	vi.resetModules();
	const kit = await import("../site-kit/lib/wbcom-kit");
	const id = await kit.registryPluginId("knowx");
	return {
		id,
		call: (path: string) => kit.pluginFetch("knowx", path) as ReturnType<typeof pluginFetch>,
		pluginJson: (await import("../site-kit/lib/knowx")).pluginJson,
	};
}

afterEach(() => vi.unstubAllGlobals());

describe("kit finds KnowX routes on any install", () => {
	it("computes the published registry id", async () => {
		expect(await registryPluginId("knowx")).toBe("r_2bzw2y6sgiq5c455");
	});

	it("uses the registry id on a registry install and remembers it", async () => {
		const { id, call } = await fresh();
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), url.includes(id) ? ok() : missing()));
		expect((await call("health")).status).toBe(200);
		await call("health");
		expect(seen).toEqual([`/_emdash/api/plugins/${id}/health`, `/_emdash/api/plugins/${id}/health`]);
	});

	it("falls back to the name on a local install", async () => {
		const { call } = await fresh();
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), url.includes("/knowx/") ? ok() : missing()));
		expect((await call("health")).status).toBe(200);
		await call("health");
		expect(seen.at(-1)).toBe("/_emdash/api/plugins/knowx/health");
		expect(seen).toHaveLength(3);
	});

	it("never remembers a failure, and forgets an address that stops answering", async () => {
		const { id, call } = await fresh();
		let up = false;
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), up && url.includes(id) ? ok() : missing()));
		expect((await call("health")).status).toBe(404);
		up = true;
		expect((await call("health")).status).toBe(200);
		up = false;
		seen.length = 0;
		await call("health");
		expect(seen).toHaveLength(3);
	});

	it("keeps KnowX's own 404 answer instead of trying another address", async () => {
		const { call } = await fresh();
		const seen: string[] = [];
		vi.stubGlobal(
			"fetch",
			async (url: string) => (
				seen.push(url),
				new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "No such article" } }), { status: 404 })
			),
		);
		expect((await call("tally?id=x")).status).toBe(404);
		expect(seen).toHaveLength(1);
	});

	it("sends server calls through pluginFetch with the page origin", async () => {
		const { id, pluginJson } = await fresh();
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), url.includes(id) ? ok() : missing()));
		const data = await pluginJson("http://localhost:4333", "config");
		expect(data).toMatchObject({ ok: true });
		expect(seen[0]).toBe(`http://localhost:4333/_emdash/api/plugins/${id}/config`);
	});
});
