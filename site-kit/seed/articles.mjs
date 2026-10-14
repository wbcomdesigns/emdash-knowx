function span(text) {
	return { _type: "span", text };
}

function block(style, text) {
	return { _type: "block", style, children: [span(text)] };
}

function article(id, slug, title, excerpt, category, paragraphs, extras = {}) {
	const content = [];
	for (const part of paragraphs) {
		if (part.startsWith("# ")) content.push(block("h2", part.slice(2)));
		else content.push(block("normal", part));
	}
	return {
		id,
		slug,
		status: "published",
		data: {
			title,
			excerpt,
			content,
			applies_to_version: extras.version || "",
		},
		taxonomies: { doc_category: [category] },
	};
}

function faq(id, slug, title, answer) {
	return {
		id,
		slug,
		status: "published",
		data: {
			title,
			answer: [block("normal", answer)],
		},
	};
}

export const docs = [
	article(
		"doc-welcome",
		"welcome-to-the-help-center",
		"Welcome to the help center",
		"How this help center is organised and where to start.",
		"getting-started",
		[
			"This help center answers the questions people ask most often. Start here if you are new, or use search if you already know what you need.",
			"# Who it is for",
			"Anyone who uses the product can read every article. You do not need an account.",
			"# How to find an answer",
			"Open a category, or type a few words into search. Results appear as you type.",
			"# If you still need help",
			"If an article does not cover your case, use the contact link at the end of a search with no results.",
		],
	),
	article(
		"doc-first-project",
		"create-your-first-project",
		"Create your first project",
		"Open a project and add the first piece of work.",
		"getting-started",
		[
			"A project holds the work you want to keep together. Create one before you invite anyone else.",
			"# Open a new project",
			"From the home screen, choose New project and give it a short name your team will recognise.",
			"# Add the first item",
			"Add one document or task so the project is not empty when people arrive.",
			"# Next step",
			"Invite the people who will work in it. See Invite your team.",
		],
	),
	article(
		"doc-invite-team",
		"invite-your-team",
		"Invite your team",
		"Send invites and choose what each person can do.",
		"first-week",
		[
			"People join from an email invite. They see only the projects you add them to.",
			"# Send an invite",
			"Open the project, choose People, and enter their email address.",
			"# Roles",
			"Give edit access only to people who change content. Everyone else can read.",
		],
	),
	article(
		"doc-find-what-you-need",
		"find-what-you-need",
		"Find what you need",
		"Search, filters and the category list.",
		"using-the-product",
		[
			"Search is the fastest path when you remember a word from the title. Categories help when you are browsing.",
			"# Search",
			"Type two or three words. The list updates after a short pause.",
			"# Categories",
			"Each card is a topic. Open it to see its articles.",
		],
	),
	article(
		"doc-share-a-document",
		"share-a-document",
		"Share a document",
		"Send a link that opens the right page.",
		"using-the-product",
		[
			"Every article and document has a stable link. Copy it from the address bar or from the heading link.",
			"# Who can open it",
			"Anyone with the link can read a public article. Private work stays behind a sign-in.",
		],
	),
	article(
		"doc-keyboard-shortcuts",
		"keyboard-shortcuts",
		"Keyboard shortcuts",
		"Move around the help center without a mouse.",
		"using-the-product",
		[
			"These shortcuts work on every help page.",
			"# Open search",
			"Press Control or Command and K to focus the search box.",
			"# Move through results",
			"Use the arrow keys, then Enter to open a result.",
			"# Leave search",
			"Press Escape to close the results list.",
			"# Headings",
			"Tab moves through heading copy-link buttons on an article.",
			"# Code",
			"A code block has a copy button as the next focus stop after its heading.",
		],
	),
	article(
		"doc-change-your-plan",
		"change-your-plan",
		"Change your plan",
		"Move to a different plan and what happens to your data.",
		"account-and-billing",
		[
			"You can change plan from Account. The new plan starts at the next billing date unless you choose to start it now.",
			"# What stays",
			"Your projects and people stay in place. Limits update to match the new plan.",
		],
		{ version: "2.0" },
	),
	article(
		"doc-download-an-invoice",
		"download-an-invoice",
		"Download an invoice",
		"Find a past invoice and save it as a file.",
		"account-and-billing",
		[
			"Invoices live under Account, then Billing. Each row has a download button.",
			"# Missing invoice",
			"If a month is missing, the payment for that period has not closed yet.",
		],
	),
];

export const faqs = [
	faq(
		"faq-search",
		"how-do-i-search",
		"How do I search the help center?",
		"Use the search box on the help home, or press Control or Command and K on any help page.",
	),
	faq(
		"faq-account",
		"do-i-need-an-account",
		"Do I need an account to read articles?",
		"No. Every help article is public. An account is only needed if the rest of the site asks for one.",
	),
	faq(
		"faq-contact",
		"how-do-i-get-more-help",
		"How do I get more help?",
		"If a search finds nothing, the page can show a contact link. The site owner sets that link.",
	),
];
