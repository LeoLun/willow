import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

export interface WebSearchResultItem {
  title: string;
  url: string;
}

export interface WebSearchToolDetails {
  query: string;
  searchDepth: "basic" | "advanced";
  numResults: number;
  resultCount: number;
  hasAnswer: boolean;
  results: WebSearchResultItem[];
}

interface TavilySearchResponse {
  answer?: string;
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_NUM_RESULTS = 5;

const webSearchSchema = Type.Object({
  query: Type.String({
    description: "搜索查询关键词",
  }),
  numResults: Type.Optional(
    Type.Number({
      description: "返回的搜索结果数量，默认 5",
    }),
  ),
  searchDepth: Type.Optional(
    Type.Union([Type.Literal("basic"), Type.Literal("advanced")], {
      description: "搜索深度：basic（快速）或 advanced（深度），默认 basic",
    }),
  ),
});

export function createWebSearchTool(getApiKey: () => string): AgentTool<typeof webSearchSchema> {
  return {
    name: "websearch",
    label: "网络搜索",
    description: `- 使用 Tavily 进行实时网络搜索
- 输入搜索查询关键词，获取最新的网络信息
- 支持快速搜索和深度搜索两种模式
- 当您需要获取最新信息、时事新闻或知识截止日期之后的数据时，请使用此工具
- 注意：请务必根据用户提问的时刻，推断搜索关键词的时间维度。

使用说明：
- 搜索类型：basic（快速结果）、advanced（深度搜索）
- 可配置返回结果数量（默认 5 条）`,
    parameters: webSearchSchema,
    async execute(_toolCallId, params, signal) {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("未配置 Tavily API Key，请在设置中添加");
      }

      const searchDepth = params.searchDepth ?? "basic";
      const numResults = params.numResults ?? DEFAULT_NUM_RESULTS;

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort(new Error("搜索请求超时（>25 秒）"));
      }, DEFAULT_TIMEOUT_MS);

      const abortListener = () => controller.abort(new Error("搜索请求已中止"));
      signal?.addEventListener("abort", abortListener, { once: true });

      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: apiKey,
            query: params.query,
            search_depth: searchDepth,
            max_results: numResults,
            include_answer: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`搜索请求失败（${response.status}）：${errorText}`);
        }

        const data = (await response.json()) as TavilySearchResponse;

        const parts: string[] = [];

        if (data.answer) {
          parts.push(`## 摘要\n\n${data.answer}`);
        }

        if (data.results && data.results.length > 0) {
          parts.push("## 搜索结果\n");
          for (const result of data.results) {
            parts.push(`### ${result.title}\n**URL:** ${result.url}\n\n${result.content}\n`);
          }
        }

        const output = parts.length > 0 ? parts.join("\n") : "未找到搜索结果，请尝试其他查询。";

        const details: WebSearchToolDetails = {
          query: params.query,
          searchDepth,
          numResults,
          resultCount: data.results?.length ?? 0,
          hasAnswer: !!data.answer,
          results: (data.results ?? []).map((r) => ({
            title: r.title,
            url: r.url,
          })),
        };

        return {
          content: [{ type: "text", text: output }],
          details,
        };
      } catch (error) {
        if (controller.signal.aborted && error instanceof Error && error.name === "AbortError") {
          throw new Error("搜索请求超时或已中止");
        }
        throw error;
      } finally {
        clearTimeout(timeoutHandle);
        signal?.removeEventListener("abort", abortListener);
      }
    },
  };
}
