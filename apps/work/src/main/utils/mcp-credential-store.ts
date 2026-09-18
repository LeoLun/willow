import type { McpCredential, McpCredentialStore } from "@willow/core";
import type { McpDao } from "../service/dao/mcp.dao.server";
import { LocalCredentialCipher } from "./credential-cipher";

export class SqliteMcpCredentialStore implements McpCredentialStore {
  constructor(
    private readonly dao: McpDao,
    private readonly cipher: LocalCredentialCipher,
    private readonly workspaceId: number | null,
  ) {}
  async read(key: string): Promise<McpCredential | undefined> {
    try {
      const data = this.dao.readCredential(key);
      if (!data) return undefined;
      const envelope = JSON.parse(this.cipher.decrypt(data));
      if (
        envelope.key !== key ||
        envelope.workspaceId !== this.workspaceId ||
        (this.workspaceId === null
          ? envelope.scope !== "global"
          : envelope.scope !== undefined && envelope.scope !== "project") ||
        !envelope.value ||
        typeof envelope.value !== "object"
      )
        throw new Error("Invalid MCP credential binding.");
      return envelope.value as McpCredential;
    } catch {
      throw new Error("Failed to read MCP credentials.");
    }
  }
  async write(key: string, value: McpCredential): Promise<void> {
    try {
      const serverName = key.split(":").at(-2)!;
      const encrypted = this.cipher.encrypt(
        JSON.stringify({
          key,
          workspaceId: this.workspaceId,
          scope: this.workspaceId === null ? "global" : "project",
          value,
        }),
      );
      this.dao.writeCredential(key, this.workspaceId, serverName, encrypted);
    } catch {
      throw new Error("Failed to save MCP credentials.");
    }
  }
  async delete(key: string): Promise<void> {
    this.dao.deleteCredential(key);
  }
}
