import { join } from "node:path";
import type { Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";
import { app } from "electron";
import type { CredentialDao } from "../service/dao/credential.dao.server";
import { CREDENTIAL_KEY_FILE_NAME, LocalCredentialCipher } from "./credential-cipher";

/** 校验 API Key 凭证中可选的 provider 环境变量。 */
function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

/**
 * 对解密后的 JSON 做最小运行时校验。
 * OAuth 凭证允许携带 provider 自定义字段，因此这里只检查公共必填字段。
 */
function isCredential(value: unknown): value is Credential {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type === "api_key") {
    return (
      (candidate.key === undefined || typeof candidate.key === "string") &&
      (candidate.env === undefined || isStringRecord(candidate.env))
    );
  }

  return (
    candidate.type === "oauth" &&
    typeof candidate.access === "string" &&
    typeof candidate.refresh === "string" &&
    typeof candidate.expires === "number" &&
    Number.isFinite(candidate.expires)
  );
}

export class ElectronCredentialStore implements CredentialStore {
  // 每个 provider 使用独立队列，既避免同一凭证并发刷新，又不阻塞其他 provider。
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    private readonly credentialDao: CredentialDao,
    private readonly cipher = new LocalCredentialCipher(
      join(app.getPath("userData"), CREDENTIAL_KEY_FILE_NAME),
    ),
  ) {}

  /** 读取并解密 provider 对应的凭证；不存在时返回 undefined。 */
  async read(providerId: string): Promise<Credential | undefined> {
    try {
      return await this.readCredential(providerId);
    } catch (error) {
      throw this.createStorageError("read", providerId, error);
    }
  }

  /** 枚举已保存凭证的非敏感元数据，不向调用方暴露解密后的凭证内容。 */
  async list(): Promise<readonly CredentialInfo[]> {
    const entries = await Promise.all(
      this.credentialDao.findProviderIds().map(async (providerId) => {
        const credential = await this.read(providerId);
        return credential ? { providerId, type: credential.type } : undefined;
      }),
    );
    return entries.filter((entry): entry is CredentialInfo => entry !== undefined);
  }

  /** 不读取旧值，直接加密并覆盖 provider 对应的凭证。 */
  set(providerId: string, credential: Credential): Promise<Credential> {
    return this.enqueue(providerId, async () => {
      try {
        await this.writeCredential(providerId, credential);
      } catch (error) {
        throw this.createStorageError("write", providerId, error);
      }
      return credential;
    });
  }

  modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    return this.enqueue(providerId, async () => {
      let current: Credential | undefined;
      try {
        current = await this.readCredential(providerId);
      } catch (error) {
        throw this.createStorageError("read", providerId, error);
      }

      const next = await fn(current);
      // CredentialStore 约定 undefined 表示保留当前值，不触发数据库写入。
      if (next === undefined) {
        return current;
      }

      try {
        await this.writeCredential(providerId, next);
      } catch (error) {
        throw this.createStorageError("write", providerId, error);
      }

      return next;
    });
  }

  delete(providerId: string): Promise<void> {
    return this.enqueue(providerId, async () => {
      try {
        this.credentialDao.deleteByProviderId(providerId);
      } catch (error) {
        throw this.createStorageError("delete", providerId, error);
      }
    });
  }

  /**
   * 将同一 provider 的修改操作串行化。
   * 队列尾部会吞掉上一个任务的异常，确保失败不会阻塞后续操作；调用方仍会收到原异常。
   */
  private enqueue<T>(providerId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(providerId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );

    this.chains.set(providerId, tail);
    void tail.then(() => {
      if (this.chains.get(providerId) === tail) {
        this.chains.delete(providerId);
      }
    });

    return result;
  }

  /** 从数据库读取加密数据，并在解密、解析后校验凭证结构。 */
  private async readCredential(providerId: string): Promise<Credential | undefined> {
    const storedCredential = this.credentialDao.findByProviderId(providerId);
    if (!storedCredential) {
      return undefined;
    }

    const credential = JSON.parse(this.cipher.decrypt(storedCredential.encryptedData)) as unknown;
    if (!isCredential(credential)) {
      throw new Error("Stored credential has an invalid format");
    }

    return credential;
  }

  /** 加密凭证后按 provider 写入数据库。 */
  private async writeCredential(providerId: string, credential: Credential): Promise<void> {
    const encrypted = this.cipher.encrypt(JSON.stringify(credential));
    this.credentialDao.upsert(providerId, encrypted);
  }

  private createStorageError(operation: string, providerId: string, cause: unknown): Error {
    return new Error(`Failed to ${operation} credential for provider "${providerId}"`, { cause });
  }
}
