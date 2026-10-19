import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { collectionStatus, MEMBER, SIGN_IN } from "./core";
import { pageMetadata } from "./metadata";
import {
	guestWriter,
	handleConfig,
	handleHelpful,
	handleLogSearch,
	handleProducts,
	handleTally,
	memberWriter,
} from "./public";
import { requestAddress } from "./visitor";

const plugin: SandboxedPlugin = {
	hooks: {
		"page:metadata": {
			handler: async (event, ctx) => pageMetadata(event.page, ctx),
		},
	},
	routes: {
		health: {
			public: true,
			handler: async (routeCtx, ctx) => {
				const status = await collectionStatus(ctx);
				return {
					ok: true,
					plugin: ctx.plugin.id,
					version: ctx.plugin.version,
					collectionExists: status.collectionExists,
					articleCount: status.articleCount,
					faqCollectionExists: status.faqCollectionExists,
					// False when the host gives EmDash no visitor address: guests cannot vote here,
					// and searches are not counted. Signed-in members can still vote.
					guestWrites: requestAddress(routeCtx) !== null,
				};
			},
		},
		config: { public: true, handler: async (_routeCtx, ctx) => handleConfig(ctx) },
		products: { public: true, handler: async (_routeCtx, ctx) => handleProducts(ctx) },
		// Guest writes need the visitor address EmDash gives (Cloudflare, or trustedProxyHeaders).
		// Without it they answer GUEST_UNAVAILABLE and store nothing (owner decision 2026-10-16).
		log_search: {
			public: true,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => handleLogSearch(routeCtx, ctx, guestWriter(routeCtx)),
		},
		helpful: {
			public: true,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => handleHelpful(routeCtx, ctx, guestWriter(routeCtx)),
		},
		helpful_member: {
			permission: MEMBER,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => {
				const writer = memberWriter(routeCtx);
				return writer ? handleHelpful(routeCtx, ctx, writer) : SIGN_IN;
			},
		},
		tally: { public: true, handler: async (routeCtx, ctx) => handleTally(routeCtx, ctx) },
		admin: {
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx, requestAddress(routeCtx) !== null),
		},
	},
};

export default plugin;
