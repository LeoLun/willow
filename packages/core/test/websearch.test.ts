import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWebSearchTool,
  type ToolRuntimeOptions,
  type WebSearchToolDetails,
} from "../src/index.js";

function runtime(overrides: Partial<ToolRuntimeOptions> = {}): ToolRuntimeOptions {
  return {
    cwd: process.cwd(),
    permissionMode: "request-approval",
    tavilyApiKey: "tvly-secret-test-key",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("websearch tool", () => {
  it("sends a Bearer-authenticated Tavily request and returns structured details", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        answer: "Willow is current.",
        results: [
          {
            title: "Willow news",
            url: "https://example.com/news",
            content: "Latest Willow news.",
            favicon: "https://example.com/favicon.ico",
            score: 0.9,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createWebSearchTool(runtime()).execute("search", {
      query: "  Willow latest news  ",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.tavily.com/search");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer tvly-secret-test-key",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      query: "Willow latest news",
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
      include_favicon: true,
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Latest Willow news."),
    });
    expect(result.details).toEqual<WebSearchToolDetails>({
      msg: "搜索 Willow latest news",
      kind: "websearch",
      query: "Willow latest news",
      searchDepth: "basic",
      numResults: 5,
      resultCount: 1,
      hasAnswer: true,
      results: [
        {
          title: "Willow news",
          url: "https://example.com/news",
          favicon: "https://example.com/favicon.ico",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("tvly-secret-test-key");
  });

  it("passes explicit depth and result count and handles an empty result set", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ results: [], response_time: 0.1 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createWebSearchTool(runtime()).execute("empty", {
      query: "nothing",
      numResults: 20,
      searchDepth: "advanced",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      search_depth: "advanced",
      max_results: 20,
    });
    expect(result.content).toEqual([{ type: "text", text: "未找到搜索结果，请尝试其他查询。" }]);
    expect(result.details).toMatchObject({
      resultCount: 0,
      hasAnswer: false,
      results: [],
    });
  });

  it.each([
    [{ query: " " }, "query must be a non-empty string"],
    [{ query: "test", numResults: 0 }, "numResults"],
    [{ query: "test", numResults: 21 }, "numResults"],
    [{ query: "test", numResults: 1.5 }, "numResults"],
  ])("rejects invalid parameters before fetching", async (input, message) => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createWebSearchTool(runtime()).execute("invalid", input)).rejects.toThrow(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, "authentication failed"],
    [429, "usage limit or rate limit"],
    [500, "status 500"],
  ])("returns a stable error for HTTP %s without leaking the key", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("tvly-secret-test-key", { status })),
    );

    const promise = createWebSearchTool(runtime()).execute("status", { query: "test" });
    await expect(promise).rejects.toThrow(message);
    await expect(promise).rejects.not.toThrow("tvly-secret-test-key");
  });

  it.each([
    {},
    { results: "invalid" },
    { results: [{ title: "missing fields" }] },
    { answer: 42, results: [] },
  ])("rejects malformed Tavily responses", async (payload) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload)));

    await expect(
      createWebSearchTool(runtime()).execute("malformed", { query: "test" }),
    ).rejects.toThrow("invalid");
  });

  it("rejects a configured Tavily domain denial before fetching", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createWebSearchTool(
        runtime({ sandboxPolicy: { deniedDomains: ["API.TAVILY.COM."] } }),
      ).execute("denied", { query: "test" }),
    ).rejects.toThrow("Network domain is denied by policy: api.tavily.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates caller aborts to the Tavily request", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason ?? new Error("aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const promise = createWebSearchTool(runtime()).execute(
      "abort",
      { query: "test" },
      controller.signal,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();

    await expect(promise).rejects.toThrow("aborted");
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("aborts Tavily searches after 25 seconds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(
      async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason ?? new Error("aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = createWebSearchTool(runtime()).execute("timeout", { query: "test" });
    const rejection = expect(promise).rejects.toThrow("timed out after 25 seconds");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(25_000);

    await rejection;
  });
});
