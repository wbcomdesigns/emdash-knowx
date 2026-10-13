import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { collectionStatus } from "./core";

const plugin: SandboxedPlugin = {
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
		admin: {
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx),
		},
	},
};

export default plugin;
