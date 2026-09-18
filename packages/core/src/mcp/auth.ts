import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  auth,
  discoverOAuthServerInfo,
  type OAuthClientProvider,
  type OAuthClientInformationContext,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import type {
  McpCredential,
  McpCredentialStore,
  McpServerDefinition,
  OAuthDiscoveryState,
} from "./types.js";

export class McpLoginError extends Error {}

export class McpOAuthProvider implements OAuthClientProvider {
  private verifier?: string;
  private discovery?: OAuthDiscoveryState;
  private readonly csrf = randomBytes(32).toString("hex");
  constructor(
    private readonly store: McpCredentialStore,
    private readonly key: string,
    private readonly definition: McpServerDefinition,
    private readonly assertActive: () => void,
    private readonly redirect?: string,
    private readonly open?: (url: string) => Promise<void>,
  ) {}
  get redirectUrl() {
    return this.redirect;
  }
  get clientMetadata() {
    const methods =
      this.discovery?.authorizationServerMetadata?.token_endpoint_auth_methods_supported;
    if (
      methods &&
      !methods.some((method) =>
        ["none", "client_secret_basic", "client_secret_post"].includes(method),
      )
    )
      throw new Error("Unsupported OAuth client authentication method.");
    const method =
      !methods || methods.includes("none")
        ? "none"
        : methods.includes("client_secret_basic")
          ? "client_secret_basic"
          : "client_secret_post";
    return {
      client_name: "Willow",
      redirect_uris: this.redirect ? [this.redirect] : [],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: method,
      scope: this.definition.oauth?.scope,
    };
  }
  state() {
    return this.csrf;
  }
  private async read(ctx?: OAuthClientInformationContext) {
    this.assertActive();
    const value = await this.store.read(this.key);
    if (ctx && value?.issuer && value.issuer !== ctx.issuer)
      throw new Error("MCP OAuth issuer changed; log out before signing in again.");
    return value;
  }
  private async update(patch: Partial<McpCredential>, ctx?: OAuthClientInformationContext) {
    const previous = await this.read(ctx);
    this.assertActive();
    await this.store.write(this.key, {
      ...previous,
      ...patch,
      issuer: ctx?.issuer ?? patch.issuer ?? previous?.issuer,
    });
  }
  async clientInformation(
    ctx?: OAuthClientInformationContext,
  ): Promise<StoredOAuthClientInformation | undefined> {
    const saved = await this.read(ctx);
    if (this.definition.oauth?.clientId)
      return {
        client_id: this.definition.oauth.clientId,
        client_secret: saved?.clientSecret ?? this.definition.oauth?.clientSecret,
        issuer: ctx?.issuer ?? saved?.issuer,
      };
    return saved?.clientInformation;
  }
  async saveClientInformation(
    value: StoredOAuthClientInformation,
    ctx?: OAuthClientInformationContext,
  ) {
    await this.update({ clientInformation: value, redirectUri: this.redirect }, ctx);
  }
  async tokens(ctx?: OAuthClientInformationContext): Promise<StoredOAuthTokens | undefined> {
    return (await this.read(ctx))?.tokens;
  }
  async saveTokens(tokens: StoredOAuthTokens, ctx?: OAuthClientInformationContext) {
    await this.update(
      {
        tokens,
        expiresAt:
          tokens.expires_in === undefined ? undefined : Date.now() + tokens.expires_in * 1000,
      },
      ctx,
    );
  }
  async redirectToAuthorization(url: URL) {
    this.assertActive();
    if (!this.open || !this.redirect) throw new Error("MCP authentication required.");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
      throw new Error("Unsafe MCP authorization URL.");
    try {
      await this.open(url.toString());
    } catch (error) {
      if (error instanceof McpLoginError) throw error;
      throw new McpLoginError("无法打开系统浏览器，请检查默认浏览器设置后重试。");
    }
  }
  saveCodeVerifier(value: string) {
    this.assertActive();
    this.verifier = value;
  }
  codeVerifier() {
    this.assertActive();
    if (!this.verifier) throw new Error("Missing MCP PKCE verifier.");
    return this.verifier;
  }
  saveDiscoveryState(value: OAuthDiscoveryState) {
    this.assertActive();
    this.discovery = value;
  }
  discoveryState() {
    return this.discovery;
  }
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "verifier") {
      this.verifier = undefined;
      return;
    }
    if (scope === "discovery") {
      this.discovery = undefined;
      return;
    }
    const value = await this.read();
    if (!value) return;
    if (scope === "all" || scope === "client") value.clientInformation = undefined;
    if (scope === "all" || scope === "tokens") {
      value.tokens = undefined;
      value.expiresAt = undefined;
    }
    this.assertActive();
    await this.store.write(this.key, value);
  }
}

export class McpAuthService {
  private readonly flows = new Map<string, AbortController>();
  private readonly refreshes = new Map<string, Promise<void>>();
  constructor(
    private readonly store: McpCredentialStore,
    private readonly openBrowser: (url: string) => Promise<void>,
  ) {}
  cancelLogin(key: string) {
    this.flows.get(key)?.abort();
  }
  cancelAll() {
    for (const flow of this.flows.values()) flow.abort();
  }
  async setBearerToken(key: string, token: string) {
    await this.store.write(key, { ...(await this.store.read(key)), bearerToken: token });
  }
  async logout(key: string) {
    this.cancelLogin(key);
    const value = await this.store.read(key);
    if (value)
      await this.store.write(key, { secrets: value.secrets, clientSecret: value.clientSecret });
  }
  async provider(key: string, definition: McpServerDefinition, assertActive: () => void) {
    const stored = await this.store.read(key);
    const provider = new McpOAuthProvider(
      this.store,
      key,
      definition,
      assertActive,
      stored?.redirectUri,
    );
    return {
      token: async () => {
        assertActive();
        const value = await this.store.read(key);
        if (value?.expiresAt !== undefined && value.expiresAt <= Date.now() + 30000)
          await this.refresh(key, definition, provider);
        return (await this.store.read(key))?.tokens?.access_token;
      },
      onUnauthorized: async () => {
        await this.refresh(key, definition, provider);
      },
    };
  }
  private async refresh(key: string, definition: McpServerDefinition, provider: McpOAuthProvider) {
    let promise = this.refreshes.get(key);
    if (!promise) {
      const refresh = async () => {
        if (!(await this.store.read(key))?.tokens?.refresh_token)
          throw new Error("MCP authentication required.");
        return auth(provider, {
          serverUrl: definition.url!,
          scope: definition.oauth?.scope,
          fetchFn: (input, init) =>
            fetch(input, {
              ...init,
              signal: AbortSignal.timeout(definition.requestTimeoutMs ?? 30000),
              redirect: "error",
            }),
        });
      };
      promise = refresh().then((result) => {
        if (result !== "AUTHORIZED") throw new Error("MCP authentication required.");
      });
      this.refreshes.set(key, promise);
      void promise
        .finally(() => {
          if (this.refreshes.get(key) === promise) this.refreshes.delete(key);
        })
        .catch(() => undefined);
    }
    await promise;
  }
  async login(key: string, definition: McpServerDefinition, assertActive: () => void) {
    if (!definition.url) throw new Error("OAuth requires an HTTP MCP server.");
    if (this.flows.has(key)) throw new Error("MCP login is already in progress.");
    const controller = new AbortController();
    this.flows.set(key, controller);
    let server: Server | undefined;
    const timer = setTimeout(() => controller.abort(), 300000);
    let phase = "本机回调服务启动";
    try {
      let resolveCallback!: (params: URLSearchParams) => void;
      let rejectCallback!: (error: Error) => void;
      const callback = new Promise<URLSearchParams>((resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;
      });
      void callback.catch(() => undefined);
      controller.signal.addEventListener(
        "abort",
        () => rejectCallback(new Error("MCP login cancelled or timed out.")),
        { once: true },
      );
      let provider: McpOAuthProvider;
      server = createServer((request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (
          request.method !== "GET" ||
          url.pathname !== "/callback" ||
          url.searchParams.get("state") !== provider.state()
        ) {
          response.writeHead(400).end("Invalid callback.");
          return;
        }
        if (url.searchParams.has("error") || !url.searchParams.get("code")) {
          response.writeHead(400).end("Authorization failed.");
          rejectCallback(new Error("MCP authorization failed."));
          return;
        }
        response
          .writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          })
          .end("Authorization received. Return to Willow.");
        resolveCallback(url.searchParams);
      });
      await new Promise<void>((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("MCP callback unavailable.");
      const active = () => {
        controller.signal.throwIfAborted();
        assertActive();
      };
      provider = new McpOAuthProvider(
        this.store,
        key,
        definition,
        active,
        `http://127.0.0.1:${address.port}/callback`,
        this.openBrowser,
      );
      // Dynamic registration is bound to the newly allocated redirect URI.
      if (!definition.oauth?.clientId) await provider.invalidateCredentials("client");
      const fetchFn: typeof fetch = (input, init) => {
        const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
        phase = path.includes("well-known")
          ? "授权服务发现"
          : path.includes("register")
            ? "OAuth 客户端注册"
            : path.includes("token")
              ? "Token 交换"
              : "授权准备";
        return fetch(input, { ...init, signal: controller.signal, redirect: "error" });
      };
      phase = "授权服务发现";
      const discovery = await discoverOAuthServerInfo(definition.url, { fetchFn });
      provider.saveDiscoveryState({
        authorizationServerUrl: String(discovery.authorizationServerUrl),
        authorizationServerMetadata: discovery.authorizationServerMetadata,
        resourceMetadata: discovery.resourceMetadata,
      });
      phase = "授权准备";
      const result = await auth(provider, {
        serverUrl: definition.url,
        scope: definition.oauth?.scope,
        fetchFn,
      });
      if (result === "REDIRECT") {
        phase = "浏览器授权";
        const params = await callback;
        active();
        phase = "Token 交换";
        await auth(provider, {
          serverUrl: definition.url,
          authorizationCode: params.get("code")!,
          iss: params.get("iss") ?? undefined,
          scope: definition.oauth?.scope,
          fetchFn,
        });
      }
      active();
    } catch (error) {
      if (error instanceof McpLoginError) throw error;
      throw new McpLoginError(
        controller.signal.aborted
          ? "登录已取消或超时，请重试。"
          : phase === "OAuth 客户端注册"
            ? "OAuth 客户端注册失败。请确认该服务允许 Willow 接入，或在 MCP 服务设置中填写服务方提供的 Client ID。"
            : `${phase}失败，请检查网络和服务配置后重试。`,
      );
    } finally {
      clearTimeout(timer);
      controller.abort();
      server?.closeAllConnections();
      if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
      this.flows.delete(key);
    }
  }
}
