import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetUserConfigController } from "../src/main/controllers/user-config/get.user-config.controller";
import { SetUserConfigController } from "../src/main/controllers/user-config/set.user-config.controller";
import type { CredentialService } from "../src/main/service/credential.service";
import type { UserConfigDao } from "../src/main/service/dao/user-config.dao.server";
import type { ProviderCatalogService } from "../src/main/service/provider-catalog.service";
import { UserConfigService } from "../src/main/service/user-config.service";
import type { SetUserConfigRequest } from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const find = vi.fn<UserConfigDao["find"]>();
const upsert = vi.fn<UserConfigDao["upsert"]>();
const getCredential = vi.fn<CredentialService["getCredential"]>();
const getProvider = vi.fn<ProviderCatalogService["getProvider"]>();
const userConfigDao = { find, upsert } as unknown as UserConfigDao;
const credentialService = { getCredential } as unknown as CredentialService;
const providerCatalogService = { getProvider } as unknown as ProviderCatalogService;
const service = new UserConfigService(userConfigDao, credentialService, providerCatalogService);
const getController = new GetUserConfigController(service);
const setController = new SetUserConfigController(service);

describe("user model configuration", () => {
  beforeEach(() => {
    find.mockReset();
    upsert.mockReset();
    getCredential.mockReset();
    getProvider.mockReset();
  });

  it("returns an empty configuration when none was saved", async () => {
    find.mockReturnValueOnce(undefined);

    await expect(getController.run(event, {})).resolves.toEqual({
      code: 0,
      data: {},
      msg: "ok",
    });
  });

  it("returns the saved large and small model configuration", async () => {
    find.mockReturnValueOnce({
      id: 1,
      largeModelProviderId: "openai",
      largeModelId: "gpt-large",
      smallModelProviderId: "anthropic",
      smallModelId: "claude-small",
    });

    await expect(getController.run(event, {})).resolves.toEqual({
      code: 0,
      data: {
        largeModel: { providerId: "openai", modelId: "gpt-large" },
        smallModel: { providerId: "anthropic", modelId: "claude-small" },
      },
      msg: "ok",
    });
  });

  it("validates and saves both model configurations", async () => {
    const request: SetUserConfigRequest = {
      largeModel: { providerId: "openai", modelId: "gpt-large" },
      smallModel: { providerId: "openai", modelId: "gpt-small" },
    };
    getCredential.mockResolvedValue({ type: "api_key", key: "secret" });
    getProvider.mockReturnValue({
      getModels: () => [
        { id: "gpt-large", name: "GPT Large" },
        { id: "gpt-small", name: "GPT Small" },
      ],
    } as ReturnType<ProviderCatalogService["getProvider"]>);
    find.mockReturnValueOnce(undefined);
    upsert.mockReturnValueOnce({
      id: 1,
      largeModelProviderId: "openai",
      largeModelId: "gpt-large",
      smallModelProviderId: "openai",
      smallModelId: "gpt-small",
    });

    await expect(setController.run(event, request)).resolves.toEqual({
      code: 0,
      data: request,
      msg: "ok",
    });
    expect(upsert).toHaveBeenCalledWith({
      largeModelProviderId: "openai",
      largeModelId: "gpt-large",
      smallModelProviderId: "openai",
      smallModelId: "gpt-small",
    });
  });

  it.each([
    undefined,
    { largeModel: null },
    { largeModel: { providerId: "", modelId: "model" } },
    { smallModel: { providerId: "openai", modelId: "" } },
  ])("rejects invalid input without saving", async (request) => {
    const response = await setController.run(event, request as unknown as SetUserConfigRequest);

    expect(response.code).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects an unconfigured provider", async () => {
    getCredential.mockResolvedValueOnce(undefined);

    await expect(
      service.setConfig({ largeModel: { providerId: "openai", modelId: "gpt-large" } }),
    ).rejects.toThrow("Provider openai is not configured");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("updates one model while preserving the other", async () => {
    getCredential.mockResolvedValueOnce({ type: "api_key", key: "secret" });
    getProvider.mockReturnValueOnce({
      getModels: () => [{ id: "gpt-new", name: "GPT New" }],
    } as ReturnType<ProviderCatalogService["getProvider"]>);
    find.mockReturnValueOnce({
      id: 1,
      largeModelProviderId: "openai",
      largeModelId: "gpt-old",
      smallModelProviderId: "anthropic",
      smallModelId: "claude-small",
    });
    upsert.mockReturnValueOnce({
      id: 1,
      largeModelProviderId: "openai",
      largeModelId: "gpt-new",
      smallModelProviderId: "anthropic",
      smallModelId: "claude-small",
    });

    await expect(
      service.setConfig({ largeModel: { providerId: "openai", modelId: "gpt-new" } }),
    ).resolves.toEqual({
      largeModel: { providerId: "openai", modelId: "gpt-new" },
      smallModel: { providerId: "anthropic", modelId: "claude-small" },
    });
    expect(upsert).toHaveBeenCalledWith({
      largeModelProviderId: "openai",
      largeModelId: "gpt-new",
      smallModelProviderId: "anthropic",
      smallModelId: "claude-small",
    });
  });

  it("rejects a model outside the provider catalog", async () => {
    getCredential.mockResolvedValueOnce({ type: "api_key", key: "secret" });
    getProvider.mockReturnValueOnce({
      getModels: () => [{ id: "gpt-small", name: "GPT Small" }],
    } as ReturnType<ProviderCatalogService["getProvider"]>);

    await expect(
      service.setConfig({ largeModel: { providerId: "openai", modelId: "removed" } }),
    ).rejects.toThrow("Model removed is not available for provider openai");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("propagates persistence failures", async () => {
    const error = new Error("read failed");
    find.mockImplementationOnce(() => {
      throw error;
    });

    await expect(getController.run(event, {})).rejects.toBe(error);
  });
});
