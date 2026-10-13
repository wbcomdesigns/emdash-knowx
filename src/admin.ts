import type { PluginContext } from "emdash/plugin";

import { collectionStatus } from "./core";

type Toast = { message: string; type: "success" | "error" | "info" };
export type BlockResponse = { blocks: Array<Record<string, unknown>>; toast?: Toast };

export async function renderInsights(
	ctx: PluginContext,
	extra?: Pick<BlockResponse, "toast">,
): Promise<BlockResponse> {
	const status = await collectionStatus(ctx);
	if (!status.collectionExists) {
		return {
			blocks: [
				{ type: "header", text: "Insights" },
				{
					type: "empty",
					title: "Help articles are not set up",
					description: "Add the help collection from the site kit seed, then come back here.",
				},
			],
			toast: extra?.toast,
		};
	}

	const articleLine =
		status.articleCount === 0
			? "The help collection is ready. No published articles yet."
			: `${status.articleCount} published help ${status.articleCount === 1 ? "article" : "articles"}.`;

	return {
		blocks: [
			{ type: "header", text: "Insights" },
			{ type: "section", text: articleLine },
			{
				type: "section",
				text: status.faqCollectionExists
					? "The FAQ collection is ready."
					: "The FAQ collection is not set up yet.",
			},
			{
				type: "empty",
				title: "No reports yet",
				description: "Helpfulness and search reports appear here after readers use the help center.",
			},
		],
		toast: extra?.toast,
	};
}

export async function handleAdmin(_input: unknown, ctx: PluginContext): Promise<BlockResponse> {
	return renderInsights(ctx);
}
