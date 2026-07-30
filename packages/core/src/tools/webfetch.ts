import type { AgentTool } from "@earendil-works/pi-agent-core";
import TurndownService from "turndown";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { ToolRuntimeOptions, WebFetchToolDetails } from "./types.js";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 120;
const MAX_REDIRECTS = 10;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const webFetchSchema = Type.Object({
  url: Type.String({
    description: "The complete http:// or https:// URL to fetch.",
  }),
  format: Type.Optional(
    Type.Union([Type.Literal("text"), Type.Literal("markdown"), Type.Literal("html")], {
      description: "Output format. Defaults to markdown.",
    }),
  ),
  timeout: Type.Optional(
    Type.Number({
      description: `Timeout in seconds. Must be positive and at most ${MAX_TIMEOUT_SECONDS}.`,
    }),
  ),
});

export type WebFetchToolInput = Static<typeof webFetchSchema>;
type WebFetchFormat = NonNullable<WebFetchToolInput["format"]>;

type FetchResult = {
  response: Response;
  finalUrl: URL;
  redirectCount: number;
  wasRetried: boolean;
};

export class WebFetchTool extends ToolBase<typeof webFetchSchema, WebFetchToolDetails> {
  readonly name = "webfetch";
  readonly label = "webfetch";
  readonly description = `Fetch an HTTP or HTTPS URL and return text, Markdown, or HTML.
HTTP URLs are upgraded to HTTPS. The default format is Markdown. Responses are limited to 5MB.`;
  readonly parameters = webFetchSchema;

  protected override checkParams(input: WebFetchToolInput): Error | undefined {
    if (
      input.timeout !== undefined &&
      (!Number.isFinite(input.timeout) || input.timeout <= 0 || input.timeout > MAX_TIMEOUT_SECONDS)
    ) {
      return new Error(`timeout must be positive and at most ${MAX_TIMEOUT_SECONDS} seconds`);
    }
    try {
      parseHttpUrl(input.url);
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
    return undefined;
  }

  protected override async run(
    context: ToolExecutionContext<WebFetchToolInput, WebFetchToolDetails>,
  ) {
    const format = context.input.format ?? "markdown";
    const timeoutSeconds = context.input.timeout ?? DEFAULT_TIMEOUT_SECONDS;
    const timeoutMs = timeoutSeconds * 1000;
    const controller = new AbortController();
    const timeoutError = new Error(`Web fetch timed out after ${timeoutSeconds} seconds`);
    const timeoutHandle = setTimeout(() => controller.abort(timeoutError), timeoutMs);
    const abortListener = () => controller.abort(new Error("Operation aborted"));
    context.signal?.addEventListener("abort", abortListener, { once: true });

    try {
      const approvedDomains = new Set<string>();
      const initialUrl = parseHttpUrl(context.input.url);
      const fetched = await this.fetchFollowingRedirects(
        context,
        initialUrl,
        format,
        approvedDomains,
        controller.signal,
      );
      const contentType = fetched.response.headers.get("content-type") ?? "";
      const content = await readResponseText(fetched.response, controller.signal);
      const title = extractTitle(content, contentType);
      const output = convertContent(content, contentType, format);
      const returnedFormat = resolveReturnedFormat(format, contentType);

      return this.buildResponse([{ type: "text", text: output }], {
        msg: `抓取 ${fetched.finalUrl.href}`,
        kind: "webfetch",
        url: context.input.url,
        finalUrl: fetched.finalUrl.href,
        format,
        returnedFormat,
        timeoutMs,
        contentType,
        title,
        outputLength: output.length,
        fetchStatus: fetched.response.status,
        wasRetried: fetched.wasRetried,
        redirectCount: fetched.redirectCount,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        throw reason instanceof Error ? reason : new Error("Web fetch aborted");
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
      context.signal?.removeEventListener("abort", abortListener);
    }
  }

  private async fetchFollowingRedirects(
    context: ToolExecutionContext<WebFetchToolInput, WebFetchToolDetails>,
    initialUrl: URL,
    format: WebFetchFormat,
    approvedDomains: Set<string>,
    signal: AbortSignal,
  ): Promise<FetchResult> {
    const headers = createHeaders(format);
    let currentUrl = initialUrl;
    let redirectCount = 0;
    let wasRetried = false;

    while (true) {
      await this.authorizeDomain(context, currentUrl, approvedDomains, redirectCount > 0);
      let response = await fetch(currentUrl, {
        signal,
        headers,
        redirect: "manual",
      });

      if (response.status === 403 && response.headers.get("cf-mitigated") === "challenge") {
        await response.body?.cancel();
        wasRetried = true;
        response = await fetch(currentUrl, {
          signal,
          headers: { ...headers, "User-Agent": "opencode" },
          redirect: "manual",
        });
      }

      if (!REDIRECT_STATUSES.has(response.status)) {
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`Web fetch failed with status ${response.status}`);
        }
        return { response, finalUrl: currentUrl, redirectCount, wasRetried };
      }

      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error(`Redirect response ${response.status} is missing Location`);
      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error(`Web fetch exceeded ${MAX_REDIRECTS} redirects`);
      }
      currentUrl = parseHttpUrl(new URL(location, currentUrl).href);
      redirectCount += 1;
    }
  }

  private async authorizeDomain(
    context: ToolExecutionContext<WebFetchToolInput, WebFetchToolDetails>,
    url: URL,
    approvedDomains: Set<string>,
    mayHavePartialEffects: boolean,
  ): Promise<void> {
    if (this.options.permissionMode === "full-access") return;

    const hostname = normalizeHostname(url.hostname);
    const deniedDomains = normalizedDomains(this.options.sandboxPolicy?.deniedDomains);
    if (deniedDomains.has(hostname)) {
      throw new Error(`Network domain is denied by policy: ${hostname}`);
    }

    const allowedDomains = normalizedDomains(this.options.sandboxPolicy?.allowedDomains);
    if (allowedDomains.has(hostname) || approvedDomains.has(hostname)) return;

    await this.requestPermission(context, {
      reason: "network-domain",
      display: hostname,
      mayHavePartialEffects,
    });
    approvedDomains.add(hostname);
  }
}

export function createWebFetchTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof webFetchSchema, WebFetchToolDetails> {
  return new WebFetchTool(options);
}

function parseHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("url must be a complete http:// or https:// URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("url must use http:// or https://");
  }
  if (url.username || url.password) {
    throw new Error("url must not contain embedded credentials");
  }
  if (url.protocol === "http:") url.protocol = "https:";
  return url;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function normalizedDomains(domains: readonly string[] | undefined): Set<string> {
  return new Set((domains ?? []).map(normalizeHostname).filter(Boolean));
}

function createHeaders(format: WebFetchFormat): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    Accept: getAcceptHeader(format),
    "Accept-Language": "en-US,en;q=0.9",
  };
}

function getAcceptHeader(format: WebFetchFormat): string {
  switch (format) {
    case "markdown":
      return "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
    case "text":
      return "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
    case "html":
      return "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
  }
}

async function readResponseText(response: Response, signal: AbortSignal): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declaredSize = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_SIZE) {
      await response.body?.cancel();
      throw new Error("Web fetch response exceeds the 5MB limit");
    }
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    if (signal.aborted) throw signal.reason;
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_SIZE) {
      await reader.cancel();
      throw new Error("Web fetch response exceeds the 5MB limit");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function extractTitle(content: string, contentType: string): string {
  if (!isHtmlContentType(contentType)) return "";
  const match = content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtmlEntities(match?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveReturnedFormat(
  format: WebFetchFormat,
  contentType: string,
): WebFetchToolDetails["returnedFormat"] {
  if (format === "html") return "html";
  if (format === "markdown" && isHtmlContentType(contentType)) return "markdown";
  return "text";
}

function convertContent(content: string, contentType: string, format: WebFetchFormat): string {
  if (format === "html") return content;
  if (!isHtmlContentType(contentType)) return content;
  if (format === "markdown") return convertHtmlToMarkdown(content);
  return extractTextFromHtml(content);
}

function isHtmlContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("text/html");
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
