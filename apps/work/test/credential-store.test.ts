import type { Credential } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  encryptionAvailable: true,
  encryptString: vi.fn((plainText: string) => Buffer.from(`encrypted:${plainText}`)),
  decryptString: vi.fn((encrypted: Buffer) => {
    const value = encrypted.toString();
    if (!value.startsWith("encrypted:")) {
      throw new Error("Unable to decrypt credential");
    }
    return value.slice("encrypted:".length);
  }),
}));

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => electronMocks.encryptionAvailable),
    encryptString: electronMocks.encryptString,
    decryptString: electronMocks.decryptString,
  },
}));

import { ElectronCredentialStore } from "../src/main/auth/credential-store";
import { CredentialService } from "../src/main/service/credential.service";
import type { CredentialDao } from "../src/main/service/dao/credential.dao.server";

const apiKey = (key: string): Credential => ({ type: "api_key", key });

const storedCredentials = new Map<string, Buffer>();
const credentialDao = {
  findByProviderId: vi.fn((providerId: string) => {
    const encryptedData = storedCredentials.get(providerId);
    return encryptedData ? { providerId, encryptedData } : undefined;
  }),
  upsert: vi.fn((providerId: string, encryptedData: Buffer) => {
    storedCredentials.set(providerId, encryptedData);
    return { providerId, encryptedData };
  }),
  deleteByProviderId: vi.fn((providerId: string) => storedCredentials.delete(providerId)),
} as unknown as CredentialDao;

function createStore(): ElectronCredentialStore {
  return new ElectronCredentialStore(credentialDao);
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("ElectronCredentialStore", () => {
  beforeEach(() => {
    storedCredentials.clear();
    vi.clearAllMocks();
    electronMocks.encryptionAvailable = true;
    electronMocks.encryptString.mockImplementation((plainText) =>
      Buffer.from(`encrypted:${plainText}`),
    );
    electronMocks.decryptString.mockImplementation((encrypted) => {
      const value = encrypted.toString();
      if (!value.startsWith("encrypted:")) {
        throw new Error("Unable to decrypt credential");
      }
      return value.slice("encrypted:".length);
    });
  });

  it("returns undefined when a credential does not exist", async () => {
    await expect(createStore().read("openai")).resolves.toBeUndefined();
  });

  it("encrypts, stores, and reads a credential", async () => {
    const store = createStore();
    const credential = apiKey("sk-test");

    await expect(store.modify("openai", async () => credential)).resolves.toEqual(credential);
    await expect(store.read("openai")).resolves.toEqual(credential);
    expect(electronMocks.encryptString).toHaveBeenCalledWith(JSON.stringify(credential));
    expect(electronMocks.decryptString).toHaveBeenCalledOnce();
    expect(credentialDao.upsert).toHaveBeenCalledWith("openai", expect.any(Buffer));
  });

  it("keeps the current credential when modify returns undefined", async () => {
    const store = createStore();
    const credential = apiKey("sk-current");
    await store.modify("openai", async () => credential);
    electronMocks.encryptString.mockClear();

    await expect(store.modify("openai", async () => undefined)).resolves.toEqual(credential);
    expect(electronMocks.encryptString).not.toHaveBeenCalled();
    await expect(store.read("openai")).resolves.toEqual(credential);
  });

  it("deletes an existing credential and ignores a missing credential", async () => {
    const store = createStore();
    await store.modify("openai", async () => apiKey("sk-test"));

    await expect(store.delete("openai")).resolves.toBeUndefined();
    await expect(store.delete("openai")).resolves.toBeUndefined();
    await expect(store.read("openai")).resolves.toBeUndefined();
  });

  it("preserves the credential and propagates errors from modify", async () => {
    const store = createStore();
    const credential = apiKey("sk-current");
    const callbackError = new Error("refresh failed");
    await store.modify("openai", async () => credential);

    await expect(
      store.modify("openai", async () => {
        throw callbackError;
      }),
    ).rejects.toBe(callbackError);
    await expect(store.read("openai")).resolves.toEqual(credential);
  });

  it("rejects operations when encryption is unavailable", async () => {
    const store = createStore();
    const callback = vi.fn(async () => apiKey("sk-test"));
    electronMocks.encryptionAvailable = false;

    await expect(store.read("openai")).rejects.toThrow("Credential encryption is unavailable");
    await expect(store.modify("openai", callback)).rejects.toThrow(
      "Credential encryption is unavailable",
    );
    await expect(store.delete("openai")).rejects.toThrow("Credential encryption is unavailable");
    expect(callback).not.toHaveBeenCalled();
  });

  it("rejects encrypted credentials with invalid data", async () => {
    storedCredentials.set(
      "openai",
      Buffer.from(`encrypted:${JSON.stringify({ type: "unknown" })}`),
    );

    await expect(createStore().read("openai")).rejects.toThrow(
      'Failed to read credential for provider "openai"',
    );
  });

  it("rejects credentials that cannot be decrypted", async () => {
    storedCredentials.set("openai", Buffer.from("corrupted"));

    await expect(createStore().read("openai")).rejects.toThrow(
      'Failed to read credential for provider "openai"',
    );
  });

  it("serializes modifications for the same provider", async () => {
    const store = createStore();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const events: string[] = [];

    const first = store.modify("openai", async () => {
      events.push("first:start");
      firstStarted.resolve();
      await releaseFirst.promise;
      events.push("first:end");
      return apiKey("sk-first");
    });
    await firstStarted.promise;

    const second = store.modify("openai", async (current) => {
      events.push("second:start");
      expect(current).toEqual(apiKey("sk-first"));
      return apiKey("sk-second");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst.resolve();

    await expect(Promise.all([first, second])).resolves.toEqual([
      apiKey("sk-first"),
      apiKey("sk-second"),
    ]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("continues a provider queue after a failed modification", async () => {
    const store = createStore();
    const failure = new Error("failed update");
    const failed = store.modify("openai", async () => {
      throw failure;
    });
    const recovered = store.modify("openai", async () => apiKey("sk-recovered"));

    await expect(failed).rejects.toBe(failure);
    await expect(recovered).resolves.toEqual(apiKey("sk-recovered"));
    await expect(store.read("openai")).resolves.toEqual(apiKey("sk-recovered"));
  });

  it("allows different providers to be modified independently", async () => {
    const store = createStore();
    const firstStarted = deferred();
    const releaseFirst = deferred();

    const openai = store.modify("openai", async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
      return apiKey("sk-openai");
    });
    await firstStarted.promise;

    await expect(store.modify("anthropic", async () => apiKey("sk-anthropic"))).resolves.toEqual(
      apiKey("sk-anthropic"),
    );

    releaseFirst.resolve();
    await expect(openai).resolves.toEqual(apiKey("sk-openai"));
  });

  it("CredentialService creates and reuses a DAO-backed store", async () => {
    const service = new CredentialService(credentialDao);
    const store = service.getCredentialStore();

    expect(service.getCredentialStore()).toBe(store);
    await expect(store.modify("openai", async () => apiKey("sk-service"))).resolves.toEqual(
      apiKey("sk-service"),
    );
    await expect(store.read("openai")).resolves.toEqual(apiKey("sk-service"));
  });
});
