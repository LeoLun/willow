import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { electronAPI } from "@renderer/src/lib/ipc";

type FieldsResult<T> =
  | ({ data: T; error?: undefined } & { request: Request; response: Response })
  | ({ data?: undefined; error: unknown } & {
      request: Request;
      response: Response;
    });

export type OpencodeAuth = {
  username?: string;
  password?: string;
  token?: string;
  mode?: "basic" | "willow";
};

const encodeBasicAuth = (auth?: OpencodeAuth) => {
  if (!auth?.username || !auth?.password) return null;
  const token = `${auth.username}:${auth.password}`;
  if (typeof btoa === "function") return btoa(token);
  const buffer = (
    globalThis as {
      Buffer?: {
        from: (
          input: string,
          encoding: string,
        ) => { toString: (encoding: string) => string };
      };
    }
  ).Buffer;
  return buffer ? buffer.from(token, "utf8").toString("base64") : null;
};

const resolveAuthHeader = (auth?: OpencodeAuth) => {
  if (auth?.mode === "willow" && auth.token) {
    return `Bearer ${auth.token}`;
  }
  const encoded = encodeBasicAuth(auth);
  return encoded ? `Basic ${encoded}` : null;
};

export function unwrap<T>(result: FieldsResult<T>): NonNullable<T> {
  if (result.data !== undefined) {
    return result.data as NonNullable<T>;
  }
  const message =
    result.error instanceof Error
      ? result.error.message
      : typeof result.error === "string"
        ? result.error
        : JSON.stringify(result.error);
  throw new Error(message || "Unknown error");
}

export function createClient(
  baseUrl: string,
  directory?: string,
  auth?: OpencodeAuth,
) {
  const headers: Record<string, string> = {};
  const authHeader = resolveAuthHeader(auth);
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  console.log(headers);
  return createOpencodeClient({
    baseUrl,
    directory,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

export async function waitForHealthy(
  client: ReturnType<typeof createClient>,
  options?: { timeoutMs?: number; pollMs?: number },
) {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const pollMs = options?.pollMs ?? 250;

  const start = Date.now();
  let lastError: string | null = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const health = unwrap(await client.global.health());
      if (health.healthy) {
        return health;
      }
      lastError = "Server reported unhealthy";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(lastError ?? "Timed out waiting for server health");
}
