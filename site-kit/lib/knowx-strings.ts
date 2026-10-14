/** Every phrase a visitor can see. Edit this file to reword or translate the kit. */

export const kx = {
	homeTitle: "Help center",
	homeLead: "Search for an answer, or browse a topic.",
	searchPlaceholder: "Search the help center",
	searchSubmit: "Search",
	searchTitle: "Search",
	searchResultsFor: (q: string) => {
		const shown = q.length > 100 ? `${q.slice(0, 100)}…` : q;
		return `Results for "${shown}"`;
	},
	searchPrompt: "Type a few words to search.",
	searchLoading: "Searching…",
	searchNone: "No articles match that search.",
	searchNoneHint: "Try a shorter phrase, or browse a topic from the help home.",
	searchError: "Search could not run. Try again in a moment.",
	searchOpen: "Open search",
	kindHelp: "Help article",
	kindFaq: "FAQ",
	kindPost: "Post",
	kindPage: "Page",
	categoriesHeading: "Topics",
	articlesHeading: "Articles",
	emptyHomeTitle: "No help articles yet",
	emptyHomeHint: "Articles appear here once they are published.",
	emptyCategoryTitle: "No articles in this topic yet",
	emptyCategoryHint: "Try another topic, or search the help center.",
	breadcrumbHelp: "Help",
	faqTitle: "Frequently asked questions",
	faqLead: "Short answers to the questions people ask most often.",
	faqEmptyTitle: "No questions yet",
	faqEmptyHint: "Questions appear here once they are published.",
	notFoundTitle: "This article is not here",
	notFoundHint: "It may have moved. Search the help center, or go back to the help home.",
	backHome: "Back to the help home",
	tocTitle: "On this page",
	copyLink: "Copy link",
	copiedLink: "Link copied",
	copyCode: "Copy code",
	copiedCode: "Copied",
	lastUpdated: "Last updated",
	appliesTo: "Applies to version",
	previous: "Previous",
	next: "Next",
	related: "Related articles",
	helpfulQuestion: "Was this helpful?",
	helpfulYes: "Yes",
	helpfulNo: "No",
	helpfulThanks: "Thanks for the feedback.",
	helpfulCommentThanks: "Thanks. Your comment was sent.",
	/** Read by screen readers only: "{yes} of {total} readers found this helpful." */
	helpfulTally: "{yes} of {total} readers found this helpful.",
	helpfulCommentLabel: "What was missing?",
	helpfulCommentHint: "Optional. Up to 500 characters.",
	helpfulCommentSend: "Send comment",
	helpfulError: "Your vote could not be saved. Try again.",
	stillNeedTitle: "Still need help?",
	stillNeedBody: "If this did not answer your question, you can contact us.",
	stillNeedButton: "Contact us",
	articlesCount: (n: number) => (n === 1 ? "1 article" : `${n} articles`),
	rateLimited: "Too many requests. Try again in an hour.",
	offline: "Could not reach the site. Check your connection.",
	fallback: "Something went wrong. Try again.",
};

const KINDS: Record<string, string> = {
	docs: kx.kindHelp,
	faq: kx.kindFaq,
	posts: kx.kindPost,
	pages: kx.kindPage,
};

export function kindLabel(collection: string): string {
	return KINDS[collection.toLowerCase()] || collection;
}

const CODES: Record<string, string> = {
	VALIDATION_ERROR: kx.helpfulError,
	NOT_FOUND: kx.notFoundTitle,
	RATE_LIMITED: kx.rateLimited,
	OFFLINE: kx.offline,
	FAILED: kx.fallback,
};

export function phrase(code?: string): string {
	return CODES[code ?? ""] || kx.fallback;
}
