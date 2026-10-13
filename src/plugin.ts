import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { collectionStatus } from "./core";
import { pageMetadata } from "./metadata";
import { handleConfig, handleHelpful, handleLogSearch, handleProducts, handleTally } from "./public";

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
		config: { public: true, handler: async (_routeCtx, ctx) => handleConfig(ctx) },
		products: { public: true, handler: async (_routeCtx, ctx) => handleProducts(ctx) },
		log_search: {
			public: true,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => handleLogSearch(routeCtx, ctx),
		},
		helpful: {
			public: true,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => handleHelpful(routeCtx, ctx),
		},
		tally: { public: true, handler: async (routeCtx, ctx) => handleTally(routeCtx, ctx) },
		admin: {
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx),
		},
	},
};

export default plugin;
