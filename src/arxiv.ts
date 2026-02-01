const ARXIV_API_BASE = "https://export.arxiv.org/api/query";

export interface ArxivPaper {
	id: string;
	title: string;
	authors: string[];
	summary: string;
	published: string;
	updated: string;
	categories: string[];
	primaryCategory: string;
	comment?: string;
	journalRef?: string;
	doi?: string;
	pdfLink?: string;
	absLink?: string;
}

function decodeXmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function extractTag(xml: string, tag: string): string {
	// Match tag with optional namespace prefix
	const re = new RegExp(`<(?:[a-z]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-z]+:)?${tag}>`, "i");
	const m = xml.match(re);
	return m ? decodeXmlEntities(m[1].trim()) : "";
}

function extractAllTags(xml: string, tag: string): string[] {
	const re = new RegExp(`<(?:[a-z]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-z]+:)?${tag}>`, "gi");
	const results: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml)) !== null) {
		results.push(decodeXmlEntities(m[1].trim()));
	}
	return results;
}

function extractEntries(xml: string): string[] {
	const results: string[] = [];
	const re = /<entry>([\s\S]*?)<\/entry>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml)) !== null) {
		results.push(m[1]);
	}
	return results;
}

function extractAttribute(xml: string, tag: string, attr: string): string[] {
	const re = new RegExp(`<(?:[a-z]+:)?${tag}\\s[^>]*${attr}="([^"]*)"`, "gi");
	const results: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml)) !== null) {
		results.push(m[1]);
	}
	return results;
}

function extractLinks(entryXml: string): { pdf?: string; abs?: string } {
	let pdf: string | undefined;
	let abs: string | undefined;

	const linkRe = /<link\s[^>]*\/?\s*>/gi;
	let m: RegExpExecArray | null;
	while ((m = linkRe.exec(entryXml)) !== null) {
		const linkTag = m[0];
		if (linkTag.includes('title="pdf"')) {
			const hrefMatch = linkTag.match(/href="([^"]*)"/);
			if (hrefMatch) pdf = hrefMatch[1];
		}
		if (linkTag.includes('type="text/html"')) {
			const hrefMatch = linkTag.match(/href="([^"]*)"/);
			if (hrefMatch) abs = hrefMatch[1];
		}
	}

	return { pdf, abs };
}

function parseEntry(entryXml: string): ArxivPaper {
	const rawId = extractTag(entryXml, "id");
	const arxivId = rawId.replace("http://arxiv.org/abs/", "").replace(/v\d+$/, "");

	const authorNames = extractAllTags(entryXml, "name");
	const categories = extractAttribute(entryXml, "category", "term");
	const links = extractLinks(entryXml);

	// Primary category from arxiv namespace
	const primaryCatMatch = entryXml.match(/<arxiv:primary_category[^>]*term="([^"]*)"/);
	const primaryCategory = primaryCatMatch?.[1] ?? categories[0] ?? "";

	return {
		id: arxivId,
		title: extractTag(entryXml, "title").replace(/\s+/g, " "),
		authors: authorNames,
		summary: extractTag(entryXml, "summary").replace(/\s+/g, " "),
		published: extractTag(entryXml, "published"),
		updated: extractTag(entryXml, "updated"),
		categories,
		primaryCategory,
		comment: extractTag(entryXml, "comment") || undefined,
		journalRef: extractTag(entryXml, "journal_ref") || undefined,
		doi: extractTag(entryXml, "doi") || undefined,
		pdfLink: links.pdf,
		absLink: links.abs,
	};
}

interface SearchParams {
	query?: string;
	author?: string;
	category?: string;
	idList?: string[];
	maxResults?: number;
	sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
	sortOrder?: "ascending" | "descending";
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function queryArxiv(params: SearchParams): Promise<ArxivPaper[]> {
	const urlParams = new URLSearchParams();

	const queryParts: string[] = [];
	if (params.query) {
		queryParts.push(`all:${params.query}`);
	}
	if (params.author) {
		queryParts.push(`au:${params.author}`);
	}
	if (params.category) {
		queryParts.push(`cat:${params.category}`);
	}

	if (queryParts.length > 0) {
		urlParams.set("search_query", queryParts.join("+AND+"));
	}

	if (params.idList && params.idList.length > 0) {
		urlParams.set("id_list", params.idList.join(","));
	}

	urlParams.set("max_results", String(params.maxResults ?? 10));
	urlParams.set("start", "0");

	if (params.sortBy) {
		urlParams.set("sortBy", params.sortBy);
		urlParams.set("sortOrder", params.sortOrder ?? "descending");
	}

	const url = `${ARXIV_API_BASE}?${urlParams.toString()}`;

	let lastError: Error | null = null;
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			await sleep(BASE_DELAY_MS * attempt);
		}

		const response = await fetch(url, {
			headers: { "User-Agent": "arxiv-mcp-server/1.0" },
		});

		if (response.status === 429 || response.status === 503) {
			lastError = new Error(
				`arXiv API rate limited (${response.status}), attempt ${attempt + 1}/${MAX_RETRIES}`
			);
			continue;
		}

		if (!response.ok) {
			throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
		}

		const xml = await response.text();
		const entries = extractEntries(xml);
		return entries.map(parseEntry);
	}

	throw lastError ?? new Error("arXiv API request failed after retries");
}

export function formatPaperSummary(paper: ArxivPaper): string {
	return [
		`**${paper.title}**`,
		`arXiv ID: ${paper.id}`,
		`Authors: ${paper.authors.join(", ")}`,
		`Published: ${paper.published.split("T")[0]}`,
		`Category: ${paper.primaryCategory}`,
		`Summary: ${paper.summary.slice(0, 300)}${paper.summary.length > 300 ? "..." : ""}`,
		paper.absLink ? `Link: ${paper.absLink}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

export function formatPaperDetail(paper: ArxivPaper): string {
	const lines = [
		`**${paper.title}**`,
		"",
		`arXiv ID: ${paper.id}`,
		`Authors: ${paper.authors.join(", ")}`,
		`Published: ${paper.published.split("T")[0]}`,
		`Updated: ${paper.updated.split("T")[0]}`,
		`Primary Category: ${paper.primaryCategory}`,
		`All Categories: ${paper.categories.join(", ")}`,
	];

	if (paper.comment) lines.push(`Comment: ${paper.comment}`);
	if (paper.journalRef) lines.push(`Journal: ${paper.journalRef}`);
	if (paper.doi) lines.push(`DOI: ${paper.doi}`);
	if (paper.pdfLink) lines.push(`PDF: ${paper.pdfLink}`);
	if (paper.absLink) lines.push(`Abstract Page: ${paper.absLink}`);

	lines.push("", "**Abstract:**", paper.summary);

	return lines.join("\n");
}
