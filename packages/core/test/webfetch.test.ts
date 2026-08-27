import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWebFetchTool,
  type ToolApprovalHandler,
  type ToolRuntimeOptions,
} from "../src/index.js";

function runtime(overrides: Partial<ToolRuntimeOptions> = {}): ToolRuntimeOptions {
  return {
    cwd: process.cwd(),
    permissionMode: "request-approval",
    requestApproval: async () => "allow",
    ...overrides,
  };
}

function mockResponses(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("webfetch parameters and formats", () => {
  it("rejects invalid URLs and timeout values before fetching", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const tool = createWebFetchTool(runtime());

    await expect(tool.execute("relative", { url: "/relative" })).rejects.toThrow(
      "complete http:// or https://",
    );
    await expect(tool.execute("protocol", { url: "file:///tmp/value" })).rejects.toThrow(
      "http:// or https://",
    );
    await expect(
      tool.execute("credentials", { url: "https://user:secret@example.com/" }),
    ).rejects.toThrow("must not contain embedded credentials");
    await expect(
      tool.execute("timeout-zero", { url: "https://example.com", timeout: 0 }),
    ).rejects.toThrow("timeout must be positive");
    await expect(
      tool.execute("timeout-max", { url: "https://example.com", timeout: 121 }),
    ).rejects.toThrow("at most 120");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("upgrades HTTP to HTTPS and converts HTML to Markdown", async () => {
    const fetchMock = mockResponses(
      new Response(
        "<html><head><title>Hello &amp; Willow</title></head><body><h1>Hello</h1><p>Body</p></body></html>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      ),
    );
    const result = await createWebFetchTool(runtime()).execute("markdown", {
      url: "http://Example.com/docs",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://example.com/docs"),
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(result.content[0]).toEqual(
      expect.objectContaining({ type: "text", text: expect.stringContaining("# Hello") }),
    );
    expect(result.details).toEqual(
      expect.objectContaining({
        kind: "webfetch",
        title: "Hello & Willow",
        returnedFormat: "markdown",
        finalUrl: "https://example.com/docs",
      }),
    );
  });

  it("returns cleaned text, raw HTML, and non-HTML content", async () => {
    const html = "<style>hidden</style><p>Hello&nbsp; world</p><script>bad()</script><p>Next</p>";
    const fetchMock = mockResponses(
      new Response(html, { headers: { "content-type": "text/html" } }),
      new Response(html, { headers: { "content-type": "text/html" } }),
      new Response("plain **content**", { headers: { "content-type": "text/plain" } }),
    );
    const tool = createWebFetchTool(runtime({ permissionMode: "full-access" }));

    const textResult = await tool.execute("text", {
      url: "https://example.com/text",
      format: "text",
    });
    const htmlResult = await tool.execute("html", {
      url: "https://example.com/html",
      format: "html",
    });
    const plainResult = await tool.execute("plain", {
      url: "https://example.com/plain",
      format: "markdown",
    });

    expect(textResult.content).toEqual([{ type: "text", text: "Hello world\nNext" }]);
    expect(htmlResult.content).toEqual([{ type: "text", text: html }]);
    expect(plainResult.content).toEqual([{ type: "text", text: "plain **content**" }]);
    expect(plainResult.details.returnedFormat).toBe("text");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("webfetch domain authorization", () => {
  it.each(["request-approval", "delegate-approval", "full-access"] as const)(
    "fetches directly without approval in %s mode",
    async (permissionMode) => {
      const fetchMock = mockResponses(new Response("allowed"));
      const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
      const result = await createWebFetchTool(runtime({ permissionMode, requestApproval })).execute(
        "network",
        { url: "https://Example.com/value" },
      );

      expect(requestApproval).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result.content).toEqual([{ type: "text", text: "allowed" }]);
    },
  );

  it("allows configured domains without approval and gives denied domains precedence", async () => {
    const fetchMock = mockResponses(new Response("allowed"));
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const allowedTool = createWebFetchTool(runtime({ requestApproval }));
    await allowedTool.execute("allowed", { url: "https://example.com" });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();

    const deniedTool = createWebFetchTool(
      runtime({
        requestApproval,
        sandboxPolicy: { deniedDomains: ["EXAMPLE.COM."] },
      }),
    );
    await expect(deniedTool.execute("denied", { url: "https://example.com" })).rejects.toThrow(
      "denied by policy",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ignores rejection and a missing approval callback", async () => {
    const fetchMock = mockResponses(new Response("first"), new Response("second"));
    const deny = vi.fn<ToolApprovalHandler>(async () => "deny");

    await expect(
      createWebFetchTool(runtime({ requestApproval: deny })).execute("denied", {
        url: "https://example.com",
      }),
    ).resolves.toBeDefined();
    await expect(
      createWebFetchTool(runtime({ requestApproval: undefined })).execute("missing", {
        url: "https://example.com",
      }),
    ).resolves.toBeDefined();
    expect(deny).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("enforces denied domains in full-access mode", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");

    await expect(
      createWebFetchTool(
        runtime({
          permissionMode: "full-access",
          requestApproval,
          sandboxPolicy: { deniedDomains: ["example.com"] },
        }),
      ).execute("full", { url: "https://example.com" }),
    ).rejects.toThrow("denied by policy");

    expect(requestApproval).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows redirect domains without approval", async () => {
    const fetchMock = mockResponses(
      new Response(null, { status: 302, headers: { location: "https://second.test/a" } }),
      new Response(null, { status: 302, headers: { location: "https://second.test/b" } }),
      new Response("done"),
    );
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createWebFetchTool(runtime({ requestApproval })).execute("redirect", {
      url: "https://first.test/start",
    });

    expect(requestApproval).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.details.redirectCount).toBe(2);
    expect(result.details.finalUrl).toBe("https://second.test/b");
  });

  it("does not fetch a redirected domain denied by policy", async () => {
    const fetchMock = mockResponses(
      new Response(null, { status: 302, headers: { location: "https://blocked.test/" } }),
    );
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

    await expect(
      createWebFetchTool(
        runtime({ requestApproval, sandboxPolicy: { deniedDomains: ["blocked.test"] } }),
      ).execute("redirect-denied", { url: "https://first.test/" }),
    ).rejects.toThrow("denied by policy");
    expect(requestApproval).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("webfetch HTTP behavior", () => {
  it("retries a Cloudflare challenge once with the fallback user agent", async () => {
    const fetchMock = mockResponses(
      new Response("challenge", {
        status: 403,
        headers: { "cf-mitigated": "challenge" },
      }),
      new Response("success"),
    );
    const result = await createWebFetchTool(runtime({ permissionMode: "full-access" })).execute(
      "cloudflare",
      { url: "https://example.com" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": "opencode" }),
      }),
    );
    expect(result.details.wasRetried).toBe(true);
  });

  it("rejects unsuccessful responses and redirects without locations", async () => {
    const fetchMock = mockResponses(
      new Response("failure", { status: 500 }),
      new Response(null, { status: 302 }),
    );
    const tool = createWebFetchTool(runtime({ permissionMode: "full-access" }));

    await expect(tool.execute("status", { url: "https://example.com/status" })).rejects.toThrow(
      "status 500",
    );
    await expect(tool.execute("location", { url: "https://example.com/redirect" })).rejects.toThrow(
      "missing Location",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("limits redirects to ten", async () => {
    const redirects = Array.from(
      { length: 11 },
      (_, index) =>
        new Response(null, {
          status: 302,
          headers: { location: `https://example.com/${index + 1}` },
        }),
    );
    const fetchMock = mockResponses(...redirects);

    await expect(
      createWebFetchTool(runtime({ permissionMode: "full-access" })).execute("redirect-limit", {
        url: "https://example.com/0",
      }),
    ).rejects.toThrow("exceeded 10 redirects");
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it("rejects declared and streamed responses over 5MB", async () => {
    const oversizedChunk = new Uint8Array(3 * 1024 * 1024);
    const oversizedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversizedChunk);
        controller.enqueue(oversizedChunk);
        controller.close();
      },
    });
    const fetchMock = mockResponses(
      new Response("small", { headers: { "content-length": String(5 * 1024 * 1024 + 1) } }),
      new Response(oversizedStream),
    );
    const tool = createWebFetchTool(runtime({ permissionMode: "full-access" }));

    await expect(tool.execute("declared", { url: "https://example.com/declared" })).rejects.toThrow(
      "exceeds the 5MB limit",
    );
    await expect(tool.execute("streamed", { url: "https://example.com/streamed" })).rejects.toThrow(
      "exceeds the 5MB limit",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates timeout and task abort", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const tool = createWebFetchTool(runtime({ permissionMode: "full-access" }));

    await expect(
      tool.execute("timeout", { url: "https://example.com/timeout", timeout: 0.001 }),
    ).rejects.toThrow("timed out");

    const controller = new AbortController();
    const aborted = tool.execute("abort", { url: "https://example.com/abort" }, controller.signal);
    controller.abort();
    await expect(aborted).rejects.toThrow("Operation aborted");
  });
});
