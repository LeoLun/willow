import "reflect-metadata";
import type { Credential } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteCredentialController } from "../src/main/controllers/credential/delete.credential.controller";
import { GetConfiguredProvidersController } from "../src/main/controllers/credential/get-configured.credential.controller";
import { GetCredentialController } from "../src/main/controllers/credential/get.credential.controller";
import { SetCredentialController } from "../src/main/controllers/credential/set.credential.controller";
import type { CredentialService } from "../src/main/service/credential.service";
import type {
  DeleteCredentialRequest,
  GetCredentialRequest,
  SetCredentialRequest,
} from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const getCredential = vi.fn<CredentialService["getCredential"]>();
const getConfiguredProviderIds = vi.fn<CredentialService["getConfiguredProviderIds"]>();
const setCredential = vi.fn<CredentialService["setCredential"]>();
const deleteCredential = vi.fn<CredentialService["deleteCredential"]>();
const credentialService = {
  getCredential,
  getConfiguredProviderIds,
  setCredential,
  deleteCredential,
} as unknown as CredentialService;

const getController = new GetCredentialController(credentialService);
const getConfiguredController = new GetConfiguredProvidersController(credentialService);
const setController = new SetCredentialController(credentialService);
const deleteController = new DeleteCredentialController(credentialService);

describe("credential controllers", () => {
  beforeEach(() => {
    getCredential.mockReset();
    getConfiguredProviderIds.mockReset();
    setCredential.mockReset();
    deleteCredential.mockReset();
  });

  it("returns credential status without exposing the secret", async () => {
    const credential: Credential = { type: "api_key", key: "sk-test" };
    getCredential.mockResolvedValueOnce(credential);

    await expect(getController.run(event, { providerId: "openai" })).resolves.toEqual({
      code: 0,
      data: { configured: true },
      msg: "ok",
    });
    expect(getCredential).toHaveBeenCalledWith("openai");
  });

  it("returns configured provider IDs without exposing credentials", async () => {
    getConfiguredProviderIds.mockReturnValueOnce(["openai", "anthropic"]);

    await expect(getConfiguredController.run(event, {})).resolves.toEqual({
      code: 0,
      data: { providerIds: ["openai", "anthropic"] },
      msg: "ok",
    });
    expect(getConfiguredProviderIds).toHaveBeenCalledOnce();
  });

  it("returns an empty configured provider list", async () => {
    getConfiguredProviderIds.mockReturnValueOnce([]);

    await expect(getConfiguredController.run(event, {})).resolves.toEqual({
      code: 0,
      data: { providerIds: [] },
      msg: "ok",
    });
  });

  it("stores only an API-key credential", async () => {
    setCredential.mockResolvedValueOnce({ type: "api_key", key: "sk-test" });

    await expect(
      setController.run(event, { providerId: "openai", apiKey: "sk-test" }),
    ).resolves.toEqual({ code: 0, data: {}, msg: "ok" });
    expect(setCredential).toHaveBeenCalledWith("openai", {
      type: "api_key",
      key: "sk-test",
    });
  });

  it("reports an unconfigured provider", async () => {
    getCredential.mockResolvedValueOnce(undefined);

    await expect(getController.run(event, { providerId: "openai" })).resolves.toEqual({
      code: 0,
      data: { configured: false },
      msg: "ok",
    });
  });

  it("deletes a credential", async () => {
    deleteCredential.mockResolvedValueOnce(undefined);

    await expect(deleteController.run(event, { providerId: "openai" })).resolves.toEqual({
      code: 0,
      data: {},
      msg: "ok",
    });
    expect(deleteCredential).toHaveBeenCalledWith("openai");
  });

  it.each([undefined, { providerId: "   " }, { providerId: 42 }])(
    "rejects an invalid providerId without calling the service",
    async (request) => {
      const expected = {
        code: 400,
        msg: "providerId must be a non-empty string",
      };

      await expect(
        getController.run(event, request as unknown as GetCredentialRequest),
      ).resolves.toEqual(expected);
      await expect(
        setController.run(event, request as unknown as SetCredentialRequest),
      ).resolves.toEqual(expected);
      await expect(
        deleteController.run(event, request as unknown as DeleteCredentialRequest),
      ).resolves.toEqual(expected);
      expect(getCredential).not.toHaveBeenCalled();
      expect(setCredential).not.toHaveBeenCalled();
      expect(deleteCredential).not.toHaveBeenCalled();
    },
  );

  it("rejects an empty API key without calling the service", async () => {
    await expect(setController.run(event, { providerId: "openai", apiKey: " " })).resolves.toEqual({
      code: 400,
      msg: "apiKey must be a non-empty string",
    });
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("propagates service errors", async () => {
    const getError = new Error("credential read failed");
    const setError = new Error("credential write failed");
    const deleteError = new Error("credential delete failed");
    const configuredError = new Error("credential list failed");
    getCredential.mockRejectedValueOnce(getError);
    setCredential.mockRejectedValueOnce(setError);
    deleteCredential.mockRejectedValueOnce(deleteError);
    getConfiguredProviderIds.mockImplementationOnce(() => {
      throw configuredError;
    });

    await expect(getController.run(event, { providerId: "openai" })).rejects.toBe(getError);
    await expect(
      setController.run(event, { providerId: "openai", apiKey: "sk-test" }),
    ).rejects.toBe(setError);
    await expect(deleteController.run(event, { providerId: "openai" })).rejects.toBe(deleteError);
    await expect(getConfiguredController.run(event, {})).rejects.toBe(configuredError);
  });
});
