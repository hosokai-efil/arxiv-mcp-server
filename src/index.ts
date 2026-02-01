import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { queryArxiv, formatPaperSummary, formatPaperDetail } from "./arxiv";

export class ArxivMCP extends McpAgent {
	server = new McpServer({
		name: "arXiv Paper Search",
		version: "1.0.0",
	});

	async init() {
		this.server.tool(
			"search_papers",
			"Search for papers on arXiv by keyword, author, or category",
			{
				query: z.string().describe("Search keywords (e.g. 'transformer attention')"),
				author: z.string().optional().describe("Author name to filter by"),
				category: z
					.string()
					.optional()
					.describe("arXiv category (e.g. 'cs.AI', 'math.CO', 'physics.hep-th')"),
				max_results: z
					.number()
					.min(1)
					.max(50)
					.default(10)
					.describe("Maximum number of results to return"),
				sort_by: z
					.enum(["relevance", "lastUpdatedDate", "submittedDate"])
					.optional()
					.describe("Sort order for results"),
			},
			async ({ query, author, category, max_results, sort_by }) => {
				try {
					const papers = await queryArxiv({
						query,
						author,
						category,
						maxResults: max_results,
						sortBy: sort_by,
					});

					if (papers.length === 0) {
						return {
							content: [{ type: "text", text: "No papers found matching the query." }],
						};
					}

					const text = papers.map(formatPaperSummary).join("\n\n---\n\n");
					return {
						content: [
							{
								type: "text",
								text: `Found ${papers.length} paper(s):\n\n${text}`,
							},
						],
					};
				} catch (e) {
					return {
						content: [
							{
								type: "text",
								text: `Error searching arXiv: ${e instanceof Error ? e.message : String(e)}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		this.server.tool(
			"get_paper",
			"Get detailed information about a specific arXiv paper by its ID",
			{
				arxiv_id: z
					.string()
					.describe("arXiv paper ID (e.g. '2301.00001' or '1706.03762')"),
			},
			async ({ arxiv_id }) => {
				try {
					const papers = await queryArxiv({
						idList: [arxiv_id],
						maxResults: 1,
					});

					if (papers.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: `No paper found with ID: ${arxiv_id}`,
								},
							],
						};
					}

					return {
						content: [{ type: "text", text: formatPaperDetail(papers[0]) }],
					};
				} catch (e) {
					return {
						content: [
							{
								type: "text",
								text: `Error fetching paper: ${e instanceof Error ? e.message : String(e)}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		this.server.tool(
			"get_recent_papers",
			"Get the most recently submitted papers in a given arXiv category",
			{
				category: z
					.string()
					.describe("arXiv category (e.g. 'cs.AI', 'cs.CL', 'math.CO', 'quant-ph')"),
				max_results: z
					.number()
					.min(1)
					.max(50)
					.default(10)
					.describe("Maximum number of results to return"),
			},
			async ({ category, max_results }) => {
				try {
					const papers = await queryArxiv({
						category,
						maxResults: max_results,
						sortBy: "submittedDate",
						sortOrder: "descending",
					});

					if (papers.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: `No recent papers found in category: ${category}`,
								},
							],
						};
					}

					const text = papers.map(formatPaperSummary).join("\n\n---\n\n");
					return {
						content: [
							{
								type: "text",
								text: `${papers.length} recent paper(s) in ${category}:\n\n${text}`,
							},
						],
					};
				} catch (e) {
					return {
						content: [
							{
								type: "text",
								text: `Error fetching recent papers: ${e instanceof Error ? e.message : String(e)}`,
							},
						],
						isError: true,
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			return ArxivMCP.serve("/mcp").fetch(request, env, ctx);
		}

		if (url.pathname === "/") {
			return new Response(
				JSON.stringify({
					name: "arXiv MCP Server",
					description: "Search and retrieve papers from arXiv",
					mcp_endpoint: "/mcp",
				}),
				{
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		return new Response("Not found", { status: 404 });
	},
};
