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

// These cases are browser calls (relative addresses). A server-side call is tested on its own below.
const inBrowser = () => vi.stubGlobal("window", {});

describe("kit finds KnowX routes on any install", () => {
	it("computes the published registry id", async () => {
		expect(await registryPluginId("knowx")).toBe("r_2bzw2y6sgiq5c455");
	});

	it("uses the registry id on a registry install and remembers it", async () => {
		inBrowser();
		const { id, call } = await fresh();
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), url.includes(id) ? ok() : missing()));
		expect((await call("health")).status).toBe(200);
		await call("health");
		expect(seen).toEqual([`/_emdash/api/plugins/${id}/health`, `/_emdash/api/plugins/${id}/health`]);
	});

	it("falls back to the name on a local install", async () => {
		inBrowser();
		const { call } = await fresh();
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), url.includes("/knowx/") ? ok() : missing()));
		expect((await call("health")).status).toBe(200);
		await call("health");
		expect(seen.at(-1)).toBe("/_emdash/api/plugins/knowx/health");
		expect(seen).toHaveLength(3);
	});

	it("never remembers a failure, and forgets an address that stops answering", async () => {
		inBrowser();
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
		inBrowser();
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

	it("sends server calls through EmDash's in-process route handler, never fetch", async () => {
		const { id, pluginJson } = await fresh();
		const seen: string[] = [];
		const routed: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), ok()));
		const locals = {
			emdash: {
				handlePublicPluginApiRoute: async (pluginId: string, method: string, path: string) => (
					routed.push(`${method} ${pluginId}/${path}`),
					pluginId === id ? { success: true, data: { ok: true, contactUrl: "" } } : { success: false, error: { code: "NOT_FOUND", message: "Plugin route not found" } }
				),
			},
		};
		const data = await pluginJson(locals, "config");
		expect(data).toMatchObject({ ok: true });
		expect(routed).toEqual([`GET ${id}/config`]);
		expect(seen).toHaveLength(0);
	});

});

describe("server-side calls", () => {
	it("pluginFetch refuses every server-side call, so no address is ever fetched from server code", async () => {
		vi.resetModules();
		const kit = await import("../site-kit/lib/wbcom-kit");
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), ok()));
		expect((await kit.pluginFetch("knowx", "config")).status).toBe(503);
		expect(seen).toHaveLength(0);
	});

	it("callPluginRoute falls back from the registry id to the plugin name, and says when it is not installed", async () => {
		vi.resetModules();
		const kit = await import("../site-kit/lib/wbcom-kit");
		const id = await kit.registryPluginId("knowx");
		const routed: string[] = [];
		const handler = (installed: string) => async (pluginId: string, _method: string, path: string) => (
			routed.push(`${pluginId}/${path}`),
			pluginId === installed ? { success: true, data: { ok: true } } : { success: false, error: { code: "NOT_FOUND", message: "Plugin route not found" } }
		);
		expect(await kit.callPluginRoute({ emdash: { handlePublicPluginApiRoute: handler("knowx") } }, "knowx", "config")).toMatchObject({ ok: true });
		expect(routed).toEqual([`${id}/config`, "knowx/config"]);
		expect(await kit.callPluginRoute({ emdash: { handlePublicPluginApiRoute: handler("other") } }, "knowx", "config")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
		expect(await kit.callPluginRoute({}, "knowx", "config")).toMatchObject({ ok: false, error: { code: "UNAVAILABLE" } });
	});
});
