import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteTavilyApiKeyController } from "../src/main/controllers/tavily/delete-api-key.tavily.controller";
import { GetTavilySettingsController } from "../src/main/controllers/tavily/get-settings.tavily.controller";
import { SetTavilyApiKeyController } from "../src/main/controllers/tavily/set-api-key.tavily.controller";
import type { CredentialService } from "../src/main/service/credential.service";
import { TavilyService } from "../src/main/service/tavily.service";

const usagePayload = {
  key: { usage: 10, limit: 1_000 },
  account: {
    current_plan: "Bootstrap",
    plan_usage: 500,
    plan_limit: 15_000,
    paygo_usage: 0,
    paygo_limit: 100,
  },
};

const usage = {
  currentPlan: "Bootstrap",
  planUsage: 10,
  planLimit: 1_000,
};

describe("TavilyService", () => {
  const getCredential = vi.fn<CredentialService["getCredential"]>();
  const setCredential = vi.fn<CredentialService["setCredential"]>();
  const deleteCredential = vi.fn<CredentialService["deleteCredential"]>();
  const credentialService = {
    getCredential,
    setCredential,
    deleteCredential,
  } as unknown as CredentialService;
  let service: TavilyService;

  beforeEach(() => {
    getCredential.mockReset();
    setCredential.mockReset();
    deleteCredential.mockReset();
    service = new TavilyService(credentialService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports an unconfigured account without making a request", async () => {
    getCredential.mockResolvedValueOnce(undefined);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(service.getSettings()).resolves.toEqual({ configured: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns current key usage without exposing the stored key", async () => {
    getCredential.mockResolvedValueOnce({ type: "api_key", key: "tvly-secret" });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(usagePayload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await service.getSettings();

    expect(result).toEqual({ configured: true, usage });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tavily.com/usage",
      expect.objectContaining({
        headers: { Authorization: "Bearer tvly-secret" },
      }),
    );
    expect(JSON.stringify(result)).not.toContain("tvly-secret");
  });

  it("falls back to account plan usage for older usage responses", async () => {
    getCredential.mockResolvedValueOnce({ type: "api_key", key: "tvly-secret" });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          account: usagePayload.account,
        }),
      ),
    );

    await expect(service.getSettings()).resolves.toEqual({
      configured: true,
      usage: {
        currentPlan: "Bootstrap",
        planUsage: 500,
        planLimit: 15_000,
      },
    });
  });

  it("keeps configured status when usage cannot be refreshed", async () => {
    getCredential.mockResolvedValueOnce({ type: "api_key", key: "tvly-secret" });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(service.getSettings()).resolves.toEqual({
      configured: true,
      usageError: "Tavily 用量请求失败（500）",
    });
  });

  it("validates a replacement key before storing it", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(usagePayload)));
    setCredential.mockResolvedValueOnce({ type: "api_key", key: "tvly-new" });

    await expect(service.setApiKey("  tvly-new  ")).resolves.toEqual({
      configured: true,
      usage,
    });
    expect(setCredential).toHaveBeenCalledWith("tavily", {
      type: "api_key",
      key: "tvly-new",
    });
  });

  it.each([
    [401, "API Key 无效"],
    [429, "请求过于频繁"],
    [500, "用量请求失败"],
  ])("does not store a key when validation returns HTTP %s", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("tvly-secret", { status })),
    );

    await expect(service.setApiKey("tvly-secret")).rejects.toThrow(message);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { account: null },
    { account: { current_plan: "Free", plan_usage: -1, plan_limit: 1_000 } },
  ])("rejects malformed usage data before storing the key", async (payload) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload)));

    await expect(service.setApiKey("tvly-secret")).rejects.toThrow("无效的用量数据");
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("deletes only the Tavily credential", async () => {
    deleteCredential.mockResolvedValueOnce(undefined);

    await service.deleteApiKey();

    expect(deleteCredential).toHaveBeenCalledWith("tavily");
  });

  it("times out key validation without storing the key", async () => {
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

    const promise = service.setApiKey("tvly-secret");
    const rejection = expect(promise).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
    expect(setCredential).not.toHaveBeenCalled();
  });
});

describe("Tavily controllers", () => {
  const event = undefined as unknown as Electron.IpcMainInvokeEvent;
  const getSettings = vi.fn<TavilyService["getSettings"]>();
  const setApiKey = vi.fn<TavilyService["setApiKey"]>();
  const deleteApiKey = vi.fn<TavilyService["deleteApiKey"]>();
  const service = {
    getSettings,
    setApiKey,
    deleteApiKey,
  } as unknown as TavilyService;
  const getController = new GetTavilySettingsController(service);
  const setController = new SetTavilyApiKeyController(service);
  const deleteController = new DeleteTavilyApiKeyController(service);

  beforeEach(() => {
    getSettings.mockReset();
    setApiKey.mockReset();
    deleteApiKey.mockReset();
  });

  it("delegates settings, save, and delete operations", async () => {
    getSettings.mockResolvedValueOnce({ configured: true, usage });
    setApiKey.mockResolvedValueOnce({ configured: true, usage });
    deleteApiKey.mockResolvedValueOnce(undefined);

    await expect(getController.run(event, {})).resolves.toEqual({
      code: 0,
      data: { configured: true, usage },
      msg: "ok",
    });
    await expect(setController.run(event, { apiKey: "tvly-key" })).resolves.toEqual({
      code: 0,
      data: { configured: true, usage },
      msg: "ok",
    });
    await expect(deleteController.run(event, {})).resolves.toEqual({
      code: 0,
      data: {},
      msg: "ok",
    });
    expect(setApiKey).toHaveBeenCalledWith("tvly-key");
  });

  it("rejects an empty key without calling the service", async () => {
    await expect(setController.run(event, { apiKey: " " })).resolves.toEqual({
      code: 400,
      msg: "apiKey must be a non-empty string",
    });
    expect(setApiKey).not.toHaveBeenCalled();
  });

  it("propagates service failures", async () => {
    const error = new Error("failed");
    getSettings.mockRejectedValueOnce(error);
    setApiKey.mockRejectedValueOnce(error);
    deleteApiKey.mockRejectedValueOnce(error);

    await expect(getController.run(event, {})).rejects.toBe(error);
    await expect(setController.run(event, { apiKey: "tvly-key" })).rejects.toBe(error);
    await expect(deleteController.run(event, {})).rejects.toBe(error);
  });
});
