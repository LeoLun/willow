import type { PermissionMode } from "@willow/core";
import { Injectable } from "@willow/poetry";

const DEFAULT_PERMISSION_MODE: PermissionMode = "request-approval";

@Injectable()
export class PermissionModeService {
  private readonly modes = new Map<string, PermissionMode>();

  get(workspaceId: number, sessionId: string): PermissionMode {
    return this.modes.get(this.key(workspaceId, sessionId)) ?? DEFAULT_PERMISSION_MODE;
  }

  set(workspaceId: number, sessionId: string, mode: PermissionMode): void {
    this.modes.set(this.key(workspaceId, sessionId), mode);
  }

  private key(workspaceId: number, sessionId: string): string {
    return `${workspaceId}:${sessionId}`;
  }
}
