import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import TurndownService from "turndown";

export interface WebFetchToolDetails {
  url: string;
  format: "text" | "markdown" | "html";
  timeoutMs: number;
  contentType: string;
  title: string;
  outputLength: number;
  fetchStatus: number;
  wasRetried: boolean;
  returnedFormat: "text" | "markdown" | "html";
}

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30 * 1000;
const MAX_TIMEOUT_MS = 120 * 1000;

const webFetchSchema = Type.Object({
  url: Type.String({
    description: "要抓取内容的 URL，必须以 http:// 或 https:// 开头",
  }),
  format: Type.Optional(
    Type.Union([Type.Literal("text"), Type.Literal("markdown"), Type.Literal("html")], {
      description: "返回格式：text、markdown 或 html，默认 markdown",
    }),
  ),
  timeout: Type.Optional(Type.Number({ description: "超时时间（秒），最大 120 秒" })),
});

export function createWebFetchTool(): AgentTool<typeof webFetchSchema> {
  return {
    name: "webfetch",
    label: "抓取网页",
    description:
      "抓取指定 URL 的网页内容，支持以 text、markdown 或 html 格式返回。适合读取在线文档、博客、网页正文等内容。",
    parameters: webFetchSchema,
    async execute(_toolCallId, params, signal) {
      const format = params.format ?? "markdown";
      const timeoutMs = Math.min(
        Math.max((params.timeout ?? DEFAULT_TIMEOUT_MS / 1000) * 1000, 1),
        MAX_TIMEOUT_MS,
      );

      if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
        throw new Error("URL 必须以 http:// 或 https:// 开头");
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort(new Error(`请求超时（>${timeoutMs / 1000} 秒）`));
      }, timeoutMs);

      const abortListener = () => controller.abort(new Error("请求已中止"));
      signal?.addEventListener("abort", abortListener, { once: true });

      try {
        const headers = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
          Accept: getAcceptHeader(format),
          "Accept-Language": "en-US,en;q=0.9",
        };

        const initial = await fetch(params.url, {
          signal: controller.signal,
          headers,
        });

        let response = initial;
        let wasRetried = false;

        if (initial.status === 403 && initial.headers.get("cf-mitigated") === "challenge") {
          wasRetried = true;
          response = await fetch(params.url, {
            signal: controller.signal,
            headers: {
              ...headers,
              "User-Agent": "opencode",
            },
          });
        }

        if (!response.ok) {
          throw new Error(`请求失败，状态码：${response.status}`);
        }

        const contentLength = response.headers.get("content-length");
        if (contentLength && Number.parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
          throw new Error("响应内容过大，超过 5MB 限制");
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
          throw new Error("响应内容过大，超过 5MB 限制");
        }

        const content = new TextDecoder().decode(arrayBuffer);
        const contentType = response.headers.get("content-type") ?? "";
        const title = extractTitle(content, contentType);
        const output = convertContent(content, contentType, format);
        const returnedFormat = resolveReturnedFormat(format, contentType);

        const details: WebFetchToolDetails = {
          url: params.url,
          format,
          timeoutMs,
          contentType,
          title,
          outputLength: output.length,
          fetchStatus: response.status,
          wasRetried,
          returnedFormat,
        };

        return {
          content: [{ type: "text", text: output }],
          details,
        };
      } catch (error) {
        if (controller.signal.aborted && error instanceof Error && error.name === "AbortError") {
          throw new Error(`请求超时或已中止（${timeoutMs / 1000} 秒）`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutHandle);
        signal?.removeEventListener("abort", abortListener);
      }
    },
  };
}

function getAcceptHeader(format: "text" | "markdown" | "html") {
  switch (format) {
    case "markdown":
      return "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
    case "text":
      return "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
    case "html":
      return "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
  }
}

function extractTitle(content: string, contentType: string): string {
  if (!contentType.includes("text/html")) {
    return "";
  }
  const match = content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtmlEntities(match?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveReturnedFormat(
  format: "text" | "markdown" | "html",
  contentType: string,
): "text" | "markdown" | "html" {
  if (format === "html") {
    return "html";
  }
  if (format === "markdown" && contentType.includes("text/html")) {
    return "markdown";
  }
  return "text";
}

function convertContent(
  content: string,
  contentType: string,
  format: "text" | "markdown" | "html",
): string {
  if (format === "html") {
    return content;
  }

  if (!contentType.includes("text/html")) {
    return content;
  }

  if (format === "markdown") {
    return convertHtmlToMarkdown(content);
  }

  return extractTextFromHtml(content);
}

function extractTextFromHtml(html: string): string {
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "")
    .replace(
      /<\/(p|div|section|article|header|footer|aside|main|nav|h[1-6]|li|tr|pre|blockquote)>/gi,
      "$&\n",
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(cleaned)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function convertHtmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  turndownService.remove(["script", "style", "meta", "link"]);
  return turndownService.turndown(html);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}
