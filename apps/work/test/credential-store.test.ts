import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Credential } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  userDataPath: "",
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => electronMocks.userDataPath),
  },
}));

import { CredentialService } from "../src/main/service/credential.service";
import type { CredentialDao } from "../src/main/service/dao/credential.dao.server";
import {
  CREDENTIAL_KEY_FILE_NAME,
  LocalCredentialCipher,
} from "../src/main/utils/credential-cipher";
import { ElectronCredentialStore } from "../src/main/utils/credential-store";

const apiKey = (key: string): Credential => ({ type: "api_key", key });

let testDirectory: string;
const storedCredentials = new Map<string, Buffer>();
const credentialDao = {
  findProviderIds: vi.fn(() => Array.from(storedCredentials.keys())),
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
  return new ElectronCredentialStore(
    credentialDao,
    new LocalCredentialCipher(join(testDirectory, CREDENTIAL_KEY_FILE_NAME)),
  );
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
    testDirectory = mkdtempSync(join(tmpdir(), "willow-credential-"));
    electronMocks.userDataPath = testDirectory;
    storedCredentials.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true });
  });

  it("returns undefined when a credential does not exist", async () => {
    await expect(createStore().read("openai")).resolves.toBeUndefined();
  });

  it("encrypts, stores, and reads a credential", async () => {
    const store = createStore();
    const credential = apiKey("sk-test");

    await expect(store.modify("openai", async () => credential)).resolves.toEqual(credential);
    await expect(store.read("openai")).resolves.toEqual(credential);
    expect(credentialDao.upsert).toHaveBeenCalledWith("openai", expect.any(Buffer));
    expect(storedCredentials.get("openai")?.includes(Buffer.from("sk-test"))).toBe(false);
  });

  it("keeps the current credential when modify returns undefined", async () => {
    const store = createStore();
    const credential = apiKey("sk-current");
    await store.modify("openai", async () => credential);
    const encrypted = storedCredentials.get("openai");

    await expect(store.modify("openai", async () => undefined)).resolves.toEqual(credential);
    expect(storedCredentials.get("openai")).toBe(encrypted);
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

  it("creates and reuses a private 32-byte local key", () => {
    const keyPath = join(testDirectory, CREDENTIAL_KEY_FILE_NAME);
    const firstCipher = new LocalCredentialCipher(keyPath);
    const firstEncrypted = firstCipher.encrypt("first");
    const key = readFileSync(keyPath);

    expect(key).toHaveLength(32);
    if (process.platform !== "win32") {
      expect(statSync(keyPath).mode & 0o777).toBe(0o600);
    }

    const secondCipher = new LocalCredentialCipher(keyPath);
    expect(secondCipher.decrypt(firstEncrypted)).toBe("first");
    expect(readFileSync(keyPath)).toEqual(key);
  });

  it("rejects an invalid local key file", async () => {
    writeFileSync(join(testDirectory, CREDENTIAL_KEY_FILE_NAME), Buffer.alloc(31));
    const store = createStore();

    await expect(store.modify("openai", async () => apiKey("sk-test"))).rejects.toThrow(
      'Failed to write credential for provider "openai"',
    );
  });

  it("uses a random IV for each encrypted value", () => {
    const cipher = new LocalCredentialCipher(join(testDirectory, CREDENTIAL_KEY_FILE_NAME));

    expect(cipher.encrypt("same-value")).not.toEqual(cipher.encrypt("same-value"));
  });

  it("rejects encrypted credentials with invalid data", async () => {
    const cipher = new LocalCredentialCipher(join(testDirectory, CREDENTIAL_KEY_FILE_NAME));
    storedCredentials.set("openai", cipher.encrypt(JSON.stringify({ type: "unknown" })));

    await expect(createStore().read("openai")).rejects.toThrow(
      'Failed to read credential for provider "openai"',
    );
  });

  it.each([
    ["legacy safeStorage data", Buffer.from("legacy-safe-storage-data")],
    ["an unsupported version", Buffer.from("WCRD\x02invalid-data", "binary")],
    ["truncated data", Buffer.from("WCRD\x01short", "binary")],
  ])("rejects %s", async (_case, encrypted) => {
    storedCredentials.set("openai", encrypted);

    await expect(createStore().read("openai")).rejects.toThrow(
      'Failed to read credential for provider "openai"',
    );
  });

  it("rejects ciphertext that fails authentication", async () => {
    const cipher = new LocalCredentialCipher(join(testDirectory, CREDENTIAL_KEY_FILE_NAME));
    const encrypted = cipher.encrypt(JSON.stringify(apiKey("sk-test")));
    encrypted[encrypted.length - 1] ^= 1;
    storedCredentials.set("openai", encrypted);

    await expect(createStore().read("openai")).rejects.toThrow(
      'Failed to read credential for provider "openai"',
    );
  });

  it("deletes a legacy credential without loading the key", async () => {
    storedCredentials.set("openai", Buffer.from("legacy-safe-storage-data"));
    writeFileSync(join(testDirectory, CREDENTIAL_KEY_FILE_NAME), Buffer.alloc(31));

    await expect(createStore().delete("openai")).resolves.toBeUndefined();
    expect(storedCredentials.has("openai")).toBe(false);
  });

  it("overwrites a legacy credential without decrypting it", async () => {
    const store = createStore();
    storedCredentials.set("tavily", Buffer.from("legacy-safe-storage-data"));

    await expect(store.set("tavily", apiKey("tvly-new"))).resolves.toEqual(apiKey("tvly-new"));
    await expect(store.read("tavily")).resolves.toEqual(apiKey("tvly-new"));
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

  it("CredentialService delegates credential operations to its DAO-backed store", async () => {
    const service = new CredentialService(credentialDao);
    const store = service.getCredentialStore();
    const credential = apiKey("sk-service");

    expect(service.getCredentialStore()).toBe(store);
    expect(service.getConfiguredProviderIds()).toEqual([]);
    await expect(service.setCredential("openai", credential)).resolves.toEqual(credential);
    expect(service.getConfiguredProviderIds()).toEqual(["openai"]);
    await expect(service.getCredential("openai")).resolves.toEqual(credential);
    await expect(service.deleteCredential("openai")).resolves.toBeUndefined();
    await expect(service.getCredential("openai")).resolves.toBeUndefined();
  });
});
