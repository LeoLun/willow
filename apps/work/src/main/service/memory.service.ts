import { homedir } from "node:os";
import type { MemoryFileRequest, SaveMemoryRequest } from "@shared/api";
import {
  ensureMemoryFile,
  readMemory,
  saveMemory,
  setMemoryEnabled,
  type MemoryOptions,
} from "@willow/core";
import { Injectable } from "@willow/poetry";
import { shell } from "electron";
import { WorkspaceService } from "./workspace.service";

@Injectable()
export class MemoryService {
  constructor(private readonly workspaceService: WorkspaceService) {}

  private options(request: MemoryFileRequest): MemoryOptions {
    return request.scope === "global"
      ? { cwd: homedir() }
      : {
          cwd: this.workspaceService.getWorkspaceDetail(request.workspaceId).path,
          projectTrusted: true,
        };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await setMemoryEnabled({ cwd: homedir() }, enabled);
  }

  async read(request: MemoryFileRequest) {
    return readMemory(this.options(request), request.scope);
  }

  async save(request: SaveMemoryRequest) {
    const options = this.options(request);
    await saveMemory(options, request.scope, request.content, request.expectedContent);
    return readMemory(options, request.scope);
  }

  async open(request: MemoryFileRequest): Promise<void> {
    const path = await ensureMemoryFile(this.options(request), request.scope);
    const error = await shell.openPath(path);
    if (error) throw new Error(error);
  }
}
