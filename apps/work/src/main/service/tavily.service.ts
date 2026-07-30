import type {
  GetTavilySettingsResponse,
  SetTavilyApiKeyResponse,
  TavilyUsageInfo,
} from "@shared/api";
import { Injectable } from "@willow/poetry";
import { CredentialService } from "./credential.service";

export const TAVILY_CREDENTIAL_ID = "tavily";

const TAVILY_USAGE_URL = "https://api.tavily.com/usage";
const USAGE_TIMEOUT_MS = 10_000;

@Injectable()
export class TavilyService {
  constructor(private readonly credentialService: CredentialService) {}

  async getSettings(): Promise<GetTavilySettingsResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return { configured: false };
    try {
      return { configured: true, usage: await this.fetchUsage(apiKey) };
    } catch (error) {
      return { configured: true, usageError: getUsageErrorMessage(error) };
    }
  }

  async setApiKey(apiKey: string): Promise<SetTavilyApiKeyResponse> {
    const normalizedApiKey = apiKey.trim();
    const usage = await this.fetchUsage(normalizedApiKey);
    await this.credentialService.setCredential(TAVILY_CREDENTIAL_ID, {
      type: "api_key",
      key: normalizedApiKey,
    });
    return { configured: true, usage };
  }

  async deleteApiKey(): Promise<void> {
    await this.credentialService.deleteCredential(TAVILY_CREDENTIAL_ID);
  }

  async getApiKey(): Promise<string | undefined> {
    const credential = await this.credentialService.getCredential(TAVILY_CREDENTIAL_ID);
    if (credential?.type !== "api_key") return undefined;
    const apiKey = credential.key?.trim();
    return apiKey || undefined;
  }

  private async fetchUsage(apiKey: string): Promise<TavilyUsageInfo> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(new Error("Tavily usage request timed out")),
      USAGE_TIMEOUT_MS,
    );
    try {
      const response = await fetch(TAVILY_USAGE_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401) throw new Error("Tavily API Key 无效");
        if (response.status === 429) throw new Error("Tavily 请求过于频繁，请稍后重试");
        throw new Error(`Tavily 用量请求失败（${response.status}）`);
      }
      return parseTavilyUsage(await response.json());
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        throw reason instanceof Error ? reason : new Error("Tavily usage request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

function parseTavilyUsage(value: unknown): TavilyUsageInfo {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Tavily 返回了无效的用量数据");
  }
  const response = value as Record<string, unknown>;
  const account = response.account;
  if (typeof account !== "object" || account === null || Array.isArray(account)) {
    throw new Error("Tavily 返回了无效的用量数据");
  }
  const accountRecord = account as Record<string, unknown>;
  if (typeof accountRecord.current_plan !== "string") {
    throw new Error("Tavily 返回了无效的用量数据");
  }

  const key = response.key;
  const keyRecord =
    typeof key === "object" && key !== null && !Array.isArray(key)
      ? (key as Record<string, unknown>)
      : undefined;
  const usage =
    keyRecord && isUsageNumber(keyRecord.usage) && isUsageNumber(keyRecord.limit)
      ? { used: keyRecord.usage, limit: keyRecord.limit }
      : isUsageNumber(accountRecord.plan_usage) && isUsageNumber(accountRecord.plan_limit)
        ? { used: accountRecord.plan_usage, limit: accountRecord.plan_limit }
        : undefined;
  if (!usage) throw new Error("Tavily 返回了无效的用量数据");

  return {
    currentPlan: accountRecord.current_plan,
    planUsage: usage.used,
    planLimit: usage.limit,
  };
}

function isUsageNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function getUsageErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "无法连接 Tavily 用量服务";
  if (error.message.startsWith("Tavily ")) return error.message;
  return "无法连接 Tavily 用量服务";
}
