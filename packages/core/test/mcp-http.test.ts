import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { McpManager, type McpCredential } from "../src/index.js";

let server: Server;
let url: string;
let manager: McpManager;
let sse: ServerResponse | undefined;
let requireToken = false;
const calls: { path: string; authorization?: string; method: string }[] = [];
const data = new Map<string, McpCredential>();
beforeEach(async () => {
  calls.length = 0;
  data.clear();
  requireToken = false;
  server = createServer(async (request, response) => {
    const path = request.url!;
    calls.push({ path, method: request.method!, authorization: request.headers.authorization });
    if (requireToken && request.headers.authorization !== "Bearer saved-token") {
      response.writeHead(401).end();
      return;
    }
    if (path === "/redirect") {
      response.writeHead(307, { Location: "http://localhost:1/steal" }).end();
      return;
    }
    if (path === "/sse" && request.method === "POST") {
      response.writeHead(405).end();
      return;
    }
    if (path === "/sse" && request.method === "GET") {
      sse = response;
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write("event: endpoint\ndata: /messages\n\n");
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body);
    if (rpc.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    let result = {};
    if (rpc.method === "initialize")
      result = {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "http-test", version: "1" },
      };
    if (rpc.method === "tools/list")
      result = {
        tools: [{ name: "echo", description: "Echo text", inputSchema: { type: "object" } }],
      };
    if (rpc.method === "tools/call") result = { content: [{ type: "text", text: "http-ok" }] };
    const message = JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result });
    if (path === "/messages") {
      response.writeHead(202).end();
      sse!.write(`event: message\ndata: ${message}\n\n`);
    } else response.writeHead(200, { "Content-Type": "application/json" }).end(message);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  manager = new McpManager({
    cwd: process.cwd(),
    namespace: "http",
    credentials: {
      read: async (k) => data.get(k),
      write: async (k, v) => {
        data.set(k, v);
      },
      delete: async (k) => {
        data.delete(k);
      },
    },
    openBrowser: async () => undefined,
  });
});
afterEach(async () => {
  await manager.dispose();
  sse?.end();
  sse = undefined;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("MCP HTTP transports", () => {
  it("uses Authorization headers without an authentication mode", async () => {
    requireToken = true;
    await manager.register("headers", {
      type: "http",
      url: `${url}/mcp`,
      headers: { Authorization: "Bearer saved-token" },
    });
    await manager.connect("headers");
    expect(manager.snapshot().connectedCount).toBe(1);
    expect(calls.every((c) => c.authorization === "Bearer saved-token")).toBe(true);
  });

  it("connects Streamable HTTP with stored bearer credentials and calls tools", async () => {
    requireToken = true;
    await manager.register("remote", { url: `${url}/mcp` });
    await manager.setBearerToken("remote", "saved-token");
    await manager.connect("remote");
    expect(
      await manager.call(
        { serverName: "remote", toolName: "echo", arguments: {} },
        manager.fingerprint("remote"),
      ),
    ).toMatchObject({ content: [{ text: "http-ok" }] });
    expect(
      calls.filter((c) => c.path === "/mcp").every((c) => c.authorization === "Bearer saved-token"),
    ).toBe(true);
  });
  it("honors an explicit SSE transport", async () => {
    await manager.register("legacy", { type: "sse", url: `${url}/sse` });
    await manager.connect("legacy");
    expect(manager.snapshot().connectedCount).toBe(1);
    expect(calls.some((c) => c.path === "/sse" && c.method === "POST")).toBe(false);
  });
  it("falls back to SSE only for unsupported Streamable HTTP", async () => {
    await manager.register("legacy", { url: `${url}/sse` });
    await manager.connect("legacy");
    expect(manager.snapshot().connectedCount).toBe(1);
    expect((await manager.describe("legacy", "echo")).toolName).toBe("echo");
    expect(calls.some((c) => c.path === "/messages")).toBe(true);
  });
  it("does not fall back to SSE on 401 and never forwards credentials through redirects", async () => {
    requireToken = true;
    await manager.register("remote", { url: `${url}/mcp` });
    await expect(manager.connect("remote")).rejects.toThrow();
    expect(manager.snapshot().servers[0]?.status).toBe("needs-auth");
    expect(calls.some((c) => c.method === "GET")).toBe(false);
    requireToken = false;
    await manager.register("redirect", {
      url: `${url}/redirect`,
      headers: { Authorization: "Bearer private" },
    });
    await expect(manager.connect("redirect")).rejects.toThrow();
    expect(calls.some((c) => c.path.includes("steal"))).toBe(false);
  });
});
