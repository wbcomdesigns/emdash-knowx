import { emdashPluginTest } from "@emdash-cms/plugin-test/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [emdashPluginTest()],
	test: { setupFiles: ["tests/block-check.ts"],
		// Each test file builds the plugin and opens its own sandbox host. In parallel, one file can
		// read dist/manifest.json while another is still writing it ("Unexpected end of JSON input").
		fileParallelism: false,
		testTimeout: 120_000,
		hookTimeout: 120_000,
	},
});
