import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { collectionStatus } from "./core";
import { pageMetadata } from "./metadata";
import { listTopLevelCategories, useProductLayer } from "./products";

const plugin: SandboxedPlugin = {
	hooks: {
		"page:metadata": {
			handler: async (event, ctx) => pageMetadata(event.page, ctx),
		},
	},
	routes: {
		health: {
			public: true,
			handler: async (_routeCtx, ctx) => {
				const status = await collectionStatus(ctx);
				return {
					ok: true,
					plugin: ctx.plugin.id,
					version: ctx.plugin.version,
					collectionExists: status.collectionExists,
					articleCount: status.articleCount,
					faqCollectionExists: status.faqCollectionExists,
				};
			},
		},
		products: {
			public: true,
			handler: async (_routeCtx, ctx) => {
				const items = await listTopLevelCategories(ctx);
				return { ok: true, items, productLayer: useProductLayer(items) };
			},
		},
		admin: {
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx),
		},
	},
};

export default plugin;
