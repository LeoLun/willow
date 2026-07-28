import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { ToolRuntimeOptions, WebSearchToolDetails } from "./types.js";

const TAVILY_HOSTNAME = "api.tavily.com";
const TAVILY_SEARCH_URL = `https://${TAVILY_HOSTNAME}/search`;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_NUM_RESULTS = 5;
const MAX_NUM_RESULTS = 20;

const webSearchSchema = Type.Object({
  query: Type.String({
    description: "The web search query.",
    minLength: 1,
  }),
  numResults: Type.Optional(
    Type.Integer({
      description: `Number of search results to return. Defaults to ${DEFAULT_NUM_RESULTS}.`,
      minimum: 1,
      maximum: MAX_NUM_RESULTS,
    }),
  ),
  searchDepth: Type.Optional(
    Type.Union([Type.Literal("basic"), Type.Literal("advanced")], {
      description: "Search depth. Defaults to basic.",
    }),
  ),
});

export type WebSearchToolInput = Static<typeof webSearchSchema>;

type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  favicon?: string;
};

type TavilySearchResponse = {
  answer?: string;
  results: TavilySearchResult[];
};

export class WebSearchTool extends ToolBase<typeof webSearchSchema, WebSearchToolDetails> {
  readonly name = "websearch";
  readonly label = "网络搜索";
  readonly description = `Search the live web with Tavily.
Use this tool for current information, recent events, or facts that may have changed after the
model's knowledge cutoff. Prefer basic search unless the task needs deeper research.`;
  readonly parameters = webSearchSchema;

  protected override checkParams(input: WebSearchToolInput): Error | undefined {
    if (input.query.trim() === "") return new Error("query must be a non-empty string");
    if (
      input.numResults !== undefined &&
      (!Number.isInteger(input.numResults) ||
        input.numResults < 1 ||
        input.numResults > MAX_NUM_RESULTS)
    ) {
      return new Error(`numResults must be an integer between 1 and ${MAX_NUM_RESULTS}`);
    }
    return undefined;
  }

  protected override async checkPermission(): Promise<void> {
    if (this.options.permissionMode === "full-access") return;
    const deniedDomains = new Set(
      (this.options.sandboxPolicy?.deniedDomains ?? []).map(normalizeHostname).filter(Boolean),
    );
    if (deniedDomains.has(TAVILY_HOSTNAME)) {
      throw new Error(`Network domain is denied by policy: ${TAVILY_HOSTNAME}`);
    }
  }

  protected override async run(
    context: ToolExecutionContext<WebSearchToolInput, WebSearchToolDetails>,
  ) {
    const apiKey = this.options.tavilyApiKey?.trim();
    if (!apiKey) throw new Error("Tavily API key is not configured");

    const searchDepth = context.input.searchDepth ?? "basic";
    const numResults = context.input.numResults ?? DEFAULT_NUM_RESULTS;
    const query = context.input.query.trim();
    const controller = new AbortController();
    const timeoutError = new Error("Tavily search timed out after 25 seconds");
    const timeoutHandle = setTimeout(() => controller.abort(timeoutError), DEFAULT_TIMEOUT_MS);
    const abortListener = () => controller.abort(new Error("Tavily search was aborted"));
    context.signal?.addEventListener("abort", abortListener, { once: true });

    try {
      const response = await fetch(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          search_depth: searchDepth,
          max_results: numResults,
          include_answer: true,
          include_favicon: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        await response.body?.cancel();
        throw createTavilyError(response.status);
      }

      const data = parseTavilySearchResponse(await response.json());
      const output = formatSearchOutput(data);
      return this.buildResponse([{ type: "text", text: output }], {
        msg: `搜索 ${query}`,
        kind: "websearch",
        query,
        searchDepth,
        numResults,
        resultCount: data.results.length,
        hasAnswer: Boolean(data.answer),
        results: data.results.map(({ title, url, favicon }) => ({ title, url, favicon })),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        throw reason instanceof Error ? reason : new Error("Tavily search was aborted");
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
      context.signal?.removeEventListener("abort", abortListener);
    }
  }
}

export function createWebSearchTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof webSearchSchema, WebSearchToolDetails> {
  return new WebSearchTool(options);
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function createTavilyError(status: number): Error {
  if (status === 401) return new Error("Tavily authentication failed (401)");
  if (status === 429) return new Error("Tavily usage limit or rate limit reached (429)");
  return new Error(`Tavily search failed with status ${status}`);
}

function parseTavilySearchResponse(value: unknown): TavilySearchResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Tavily returned an invalid search response");
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.results)) {
    throw new Error("Tavily returned an invalid search response");
  }

  const results = record.results.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("Tavily returned an invalid search result");
    }
    const result = entry as Record<string, unknown>;
    if (
      typeof result.title !== "string" ||
      typeof result.url !== "string" ||
      typeof result.content !== "string"
    ) {
      throw new Error("Tavily returned an invalid search result");
    }
    return {
      title: result.title,
      url: result.url,
      content: result.content,
      favicon: typeof result.favicon === "string" ? result.favicon : undefined,
    };
  });

  if (record.answer !== undefined && typeof record.answer !== "string") {
    throw new Error("Tavily returned an invalid search response");
  }
  return { answer: record.answer as string | undefined, results };
}

function formatSearchOutput(data: TavilySearchResponse): string {
  const sections: string[] = [];
  if (data.answer) sections.push(`## 摘要\n\n${data.answer}`);
  if (data.results.length > 0) {
    const results = data.results.map(
      (result) => `### ${result.title}\n**URL:** ${result.url}\n\n${result.content}`,
    );
    sections.push(`## 搜索结果\n\n${results.join("\n\n")}`);
  }
  return sections.length > 0 ? sections.join("\n\n") : "未找到搜索结果，请尝试其他查询。";
}
