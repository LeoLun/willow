import { auth } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  McpAuthService,
  McpOAuthProvider,
  type McpCredential,
  type McpCredentialStore,
} from "../src/index.js";

vi.mock("@modelcontextprotocol/client", async (original) => ({
  ...(await original<object>()),
  auth: vi.fn(),
  discoverOAuthServerInfo: vi.fn(async () => ({
    authorizationServerUrl: "https://issuer.example",
    authorizationServerMetadata: { issuer: "https://issuer.example" },
  })),
}));
const data = new Map<string, McpCredential>();
const store: McpCredentialStore = {
  read: async (key) => data.get(key),
  write: async (key, value) => {
    data.set(key, structuredClone(value));
  },
  delete: async (key) => {
    data.delete(key);
  },
};
afterEach(() => {
  data.clear();
  vi.clearAllMocks();
});

describe("MCP OAuth credential binding", () => {
  it("isolates state and PKCE across concurrent flows and guards writes after disposal", async () => {
    let active = true;
    const guard = () => {
      if (!active) throw new Error("inactive");
    };
    const a = new McpOAuthProvider(store, "a", { url: "https://example.com/mcp" }, guard);
    const b = new McpOAuthProvider(store, "b", { url: "https://example.com/mcp" }, guard);
    expect(a.state()).not.toBe(b.state());
    a.saveCodeVerifier("verifier-a");
    b.saveCodeVerifier("verifier-b");
    expect(a.codeVerifier()).toBe("verifier-a");
    expect(b.codeVerifier()).toBe("verifier-b");
    expect(JSON.stringify([...data.values()])).not.toContain("verifier");
    active = false;
    await expect(a.saveTokens({ access_token: "private", token_type: "Bearer" })).rejects.toThrow(
      "inactive",
    );
    expect(data.size).toBe(0);
  });
  it("binds tokens to issuer, persists expiry, and does not launch browsers implicitly", async () => {
    const p = new McpOAuthProvider(store, "a", { url: "https://example.com/mcp" }, () => undefined);
    await p.saveTokens(
      { access_token: "access", refresh_token: "refresh", token_type: "Bearer", expires_in: 3600 },
      { issuer: "https://issuer.example" },
    );
    expect(data.get("a")?.expiresAt).toBeGreaterThan(Date.now());
    expect((await p.tokens())?.access_token).toBe("access");
    await expect(p.tokens({ issuer: "https://different.example" })).rejects.toThrow(
      "issuer changed",
    );
    await expect(p.redirectToAuthorization(new URL("https://issuer.example/auth"))).rejects.toThrow(
      "required",
    );
  });
  it("rejects unsafe authorization URLs and returns pre-registered client credentials", async () => {
    await store.write("a", { clientSecret: "client-private" });
    const open = vi.fn(async () => undefined);
    const p = new McpOAuthProvider(
      store,
      "a",
      { url: "https://example.com/mcp", oauth: { clientId: "client" } },
      () => undefined,
      "http://127.0.0.1:1/callback",
      open,
    );
    expect(await p.clientInformation()).toMatchObject({
      client_id: "client",
      client_secret: "client-private",
    });
    await expect(p.redirectToAuthorization(new URL("file:///private"))).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });
  it("reports browser launch failures without exposing underlying error data", async () => {
    const provider = new McpOAuthProvider(
      store,
      "browser",
      { url: "https://example.com/mcp" },
      () => undefined,
      "http://127.0.0.1:1/callback",
      async () => {
        throw new Error("private-secret-url");
      },
    );
    await expect(
      provider.redirectToAuthorization(new URL("https://issuer.example/auth")),
    ).rejects.toThrow("无法打开系统浏览器");
  });
  it("clears authentication on logout while preserving explicit service secrets", async () => {
    await store.write("a", {
      tokens: { access_token: "private", token_type: "Bearer" },
      bearerToken: "bearer",
      secrets: { "headers.Key": "header" },
    });
    const service = new McpAuthService(store, async () => undefined);
    await service.logout("a");
    expect(await store.read("a")).toEqual({
      secrets: { "headers.Key": "header" },
      clientSecret: undefined,
    });
  });
});

describe("MCP browser login lifecycle", () => {
  it("accepts only a callback with the flow's state and closes the callback server", async () => {
    let callbackUrl = "";
    let invalidStatus = 0;
    vi.mocked(auth).mockImplementation(async (provider, options) => {
      if (options.authorizationCode) {
        await provider.saveTokens(
          { access_token: "new-token", token_type: "Bearer" },
          { issuer: "https://issuer.example" },
        );
        return "AUTHORIZED";
      }
      callbackUrl = String(provider.redirectUrl);
      await provider.saveCodeVerifier("pkce");
      const url = new URL("https://issuer.example/auth");
      url.searchParams.set("state", String(await provider.state!()));
      await provider.redirectToAuthorization(url);
      return "REDIRECT";
    });
    const service = new McpAuthService(store, async (authorization) => {
      const state = new URL(authorization).searchParams.get("state")!;
      invalidStatus = (await fetch(`${callbackUrl}?state=wrong&code=bad`)).status;
      await fetch(`${callbackUrl}?state=${state}&code=good`);
    });
    await service.login("a", { url: "https://example.com/mcp" }, () => undefined);
    expect(invalidStatus).toBe(400);
    expect((await store.read("a"))?.tokens?.access_token).toBe("new-token");
    await expect(fetch(callbackUrl)).rejects.toThrow();
  });
  it("cancels pending login and cleans up the callback listener", async () => {
    let callbackUrl = "";
    let opened!: () => void;
    const ready = new Promise<void>((resolve) => {
      opened = resolve;
    });
    vi.mocked(auth).mockImplementation(async (provider) => {
      callbackUrl = String(provider.redirectUrl);
      await provider.redirectToAuthorization(new URL("https://issuer.example/auth"));
      return "REDIRECT";
    });
    const service = new McpAuthService(store, async () => opened());
    const login = service.login("a", { url: "https://example.com/mcp" }, () => undefined);
    await ready;
    service.cancelLogin("a");
    await expect(login).rejects.toThrow("取消");
    await expect(fetch(callbackUrl)).rejects.toThrow();
  });
  it("serializes refreshes and persists refreshed tokens", async () => {
    await store.write("a", {
      expiresAt: 1,
      tokens: { access_token: "old", refresh_token: "refresh", token_type: "Bearer" },
    });
    let finish!: () => void;
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.mocked(auth).mockImplementation(async (provider) => {
      await waiting;
      await provider.saveTokens({
        access_token: "new",
        refresh_token: "refresh",
        token_type: "Bearer",
        expires_in: 3600,
      });
      return "AUTHORIZED";
    });
    const service = new McpAuthService(store, async () => undefined);
    const provider = await service.provider(
      "a",
      { url: "https://example.com/mcp" },
      () => undefined,
    );
    const a = provider.token();
    const b = provider.token();
    await Promise.resolve();
    await Promise.resolve();
    finish();
    expect(await Promise.all([a, b])).toEqual(["new", "new"]);
    expect(auth).toHaveBeenCalledTimes(1);
  });
});
