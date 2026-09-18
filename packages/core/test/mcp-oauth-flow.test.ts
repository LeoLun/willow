import { createServer, type Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { McpManager, type McpCredential } from "../src/index.js";

describe("MCP SDK OAuth integration", () => {
  it.each([
    [false, "none"],
    [false, "client_secret_post"],
    [false, "client_secret_basic"],
    [true, "client_secret_post"],
  ] as const)(
    "guides tool discovery login and cleans up cancellation (%s, %s)",
    async (cancel, method) => {
      const controller = new AbortController();
      let origin = "";
      let redirectUri = "";
      let registeredName = "";
      let tokenRequest = new URLSearchParams();
      let tokenAuthorization = "";
      let server: Server;
      const credentials = new Map<string, McpCredential>();
      server = createServer(async (request, response) => {
        const path = request.url!;
        const json = (value: unknown) =>
          response
            .writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify(value));
        if (path.startsWith("/.well-known/oauth-protected-resource")) {
          json({ resource: `${origin}/mcp`, authorization_servers: [origin] });
          return;
        }
        if (path.startsWith("/.well-known/oauth-authorization-server")) {
          json({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            registration_endpoint: `${origin}/register`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: [method],
            code_challenge_methods_supported: ["S256"],
          });
          return;
        }
        let body = "";
        for await (const chunk of request) body += chunk;
        if (path === "/register") {
          const registration = JSON.parse(body);
          redirectUri = registration.redirect_uris[0];
          registeredName = registration.client_name;
          expect(registration.token_endpoint_auth_method).toBe(method);
          json({
            ...registration,
            client_id: "willow-client",
            client_secret: method === "none" ? undefined : "test-client-secret",
          });
          return;
        }
        if (path === "/token") {
          tokenRequest = new URLSearchParams(body);
          tokenAuthorization = request.headers.authorization ?? "";
          json({
            access_token: "oauth-token",
            refresh_token: "oauth-refresh",
            token_type: "Bearer",
            expires_in: 3600,
          });
          return;
        }
        if (path === "/mcp" && request.headers.authorization !== "Bearer oauth-token") {
          response
            .writeHead(401, {
              "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
            })
            .end();
          return;
        }
        if (path === "/mcp" && request.method === "POST") {
          const rpc = JSON.parse(body);
          if (rpc.id === undefined) {
            response.writeHead(202).end();
            return;
          }
          json({
            jsonrpc: "2.0",
            id: rpc.id,
            result:
              rpc.method === "initialize"
                ? {
                    protocolVersion: "2025-03-26",
                    capabilities: { tools: {} },
                    serverInfo: { name: "oauth-test", version: "1" },
                  }
                : { tools: [] },
          });
          return;
        }
        response.writeHead(405).end();
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      let prompted = false;
      let browserOpened = false;
      let browserOpenCount = 0;
      const manager = new McpManager({
        cwd: process.cwd(),
        namespace: "oauth",
        credentials: {
          read: async (key) => credentials.get(key),
          write: async (key, value) => {
            credentials.set(key, value);
          },
          delete: async (key) => {
            credentials.delete(key);
          },
        },
        onAuthRequired: async (_name, signal) => {
          signal.throwIfAborted();
          expect(browserOpened).toBe(false);
          prompted = true;
        },
        openBrowser: async (authorization) => {
          expect(prompted).toBe(true);
          browserOpened = true;
          browserOpenCount++;
          const url = new URL(authorization);
          expect(url.searchParams.get("code_challenge_method")).toBe("S256");
          expect(url.searchParams.get("code_challenge")).toBeTruthy();
          if (cancel) {
            controller.abort(new Error("Task stopped"));
            return;
          }
          const callback = new URL(redirectUri);
          callback.searchParams.set("state", url.searchParams.get("state")!);
          callback.searchParams.set("code", "test-code");
          await fetch(callback);
        },
      });
      try {
        await manager.register("oauth", { url: `${origin}/mcp` });
        await expect(manager.connect("oauth")).rejects.toThrow();
        expect(manager.snapshot().servers[0]?.status).toBe("needs-auth");
        expect(browserOpened).toBe(false);
        if (cancel) {
          await expect(
            manager.search({ query: "*", serverName: "oauth" }, controller.signal),
          ).rejects.toThrow("Task stopped");
          await vi.waitFor(async () => {
            await expect(fetch(redirectUri)).rejects.toThrow();
            expect(manager.snapshot().servers[0]?.status).toBe("needs-auth");
          });
          expect(credentials.get(manager.key("oauth"))?.tokens).toBeUndefined();
          return;
        }
        const results = await Promise.all([
          manager.search({ query: "*", serverName: "oauth" }),
          manager.search({ query: "", serverName: "oauth" }),
        ]);
        expect(results.every((result) => result.warnings.length === 0)).toBe(true);
        expect(browserOpened).toBe(true);
        expect(manager.snapshot().connectedCount).toBe(1);
        expect(registeredName).toBe("Willow");
        expect(browserOpenCount).toBe(1);
        expect(tokenRequest.get("code")).toBe("test-code");
        if (method === "client_secret_post")
          expect(tokenRequest.get("client_secret")).toBe("test-client-secret");
        if (method === "client_secret_basic")
          expect(tokenAuthorization).toBe(
            `Basic ${Buffer.from("willow-client:test-client-secret").toString("base64")}`,
          );
        expect(tokenRequest.get("code_verifier")).toBeTruthy();
        const stored = credentials.get(manager.key("oauth"));
        expect(stored?.tokens?.refresh_token).toBe("oauth-refresh");
        expect(stored?.issuer).toBe(origin);
      } finally {
        await manager.dispose();
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );
});
