import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import type {
  GetWorkspaceFilesResponse,
  GetWorkspaceSettingsResponse,
  UpdateWorkspaceSettingsResponse,
  WorkspaceFileNode,
} from "@shared/api";
import { Injectable } from "@willow/poetry";
import { app } from "electron";
@Injectable()
export class WorkspaceService {
  private readonly ignoredFileNames = new Set([".DS_Store"]);
  private readonly ignoredDirectoryNames = new Set([".git", "node_modules"]);

  constructor(
    private readonly workspaceDao: WorkspaceDao,
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
  ) {}

  generateWorkspaceId() {
    return Date.now();
  }

  async createDefaultWorkspace(name: string) {
    // 生成一个 ID
    const id = this.generateWorkspaceId();
    const workspacePath = join(app.getPath("userData"), "workspace", id.toString());
    await mkdir(workspacePath, { recursive: true });
    return this.workspaceDao.insert({ name, path: workspacePath, id, kind: "project" });
  }

  async getWorkspaceList() {
    const list = this.workspaceDao.findByKind("project");
    const conversation = await this.getOrCreateConversationWorkspace();
    return [conversation, ...list];
  }

  async createWorkspace(name: string, path: string) {
    return this.workspaceDao.insert({ name, path, kind: "project" });
  }

  async deleteWorkspace(id: number) {
    const sessions = this.sessionDao.findByWorkspaceId(id);
    const sessionIds = sessions.map((s) => s.id);
    this.sessionMessageDao.deleteBySessionIds(sessionIds);
    this.sessionDao.deleteByWorkspaceId(id);
    return this.workspaceDao.deleteById(id);
  }

  async getWorkspaceInfo(id: number) {
    return this.workspaceDao.findById(id);
  }

  async getOrCreateConversationWorkspace() {
    const existing = this.workspaceDao.findFirstByKind("conversation");
    if (existing) {
      await mkdir(existing.path, { recursive: true });
      return existing;
    }

    const conversationPath = join(app.getPath("home"), ".willow");
    await mkdir(conversationPath, { recursive: true });
    return this.workspaceDao.insert({
      name: "对话",
      path: conversationPath,
      kind: "conversation",
    });
  }

  async renameWorkspace(id: number, name: string) {
    return this.workspaceDao.update(id, { name });
  }

  async getWorkspaceFiles(id: number): Promise<GetWorkspaceFilesResponse> {
    const workspace = this.workspaceDao.findById(id);
    if (!workspace) {
      throw new Error("workspace not found");
    }

    const files = await this.readWorkspaceDirectoryTree(workspace.path);

    return {
      rootPath: workspace.path,
      files,
    };
  }

  async getWorkspaceSettings(id: number): Promise<GetWorkspaceSettingsResponse> {
    const workspace = this.workspaceDao.findById(id);
    if (!workspace) {
      throw new Error("workspace not found");
    }

    return {
      workspace,
      soulContent: await this.readSoulContent(workspace.path),
    };
  }

  async updateWorkspaceSettings(
    id: number,
    path: string,
    soulContent: string,
  ): Promise<UpdateWorkspaceSettingsResponse> {
    const workspace = this.workspaceDao.findById(id);
    if (!workspace) {
      throw new Error("workspace not found");
    }

    const nextPath = path.trim();
    if (!nextPath) {
      throw new Error("path is required");
    }

    await mkdir(nextPath, { recursive: true });
    await writeFile(join(nextPath, "AGENTS.md"), soulContent, "utf8");

    const updatedWorkspace =
      nextPath === workspace.path
        ? this.workspaceDao.update(id, { updatedAt: new Date() })
        : this.workspaceDao.update(id, { path: nextPath });

    if (!updatedWorkspace) {
      throw new Error("workspace update failed");
    }

    return {
      workspace: updatedWorkspace,
      soulContent,
    };
  }

  private async readSoulContent(workspacePath: string): Promise<string> {
    try {
      return await readFile(join(workspacePath, "AGENTS.md"), "utf8");
    } catch {
      return "";
    }
  }

  private async readWorkspaceDirectoryTree(rootPath: string): Promise<WorkspaceFileNode[]> {
    const entries = await readdir(rootPath, { withFileTypes: true });
    const visibleEntries = entries.filter((entry) => {
      if (entry.isDirectory() && this.ignoredDirectoryNames.has(entry.name)) {
        return false;
      }
      if (!entry.isDirectory() && this.ignoredFileNames.has(entry.name)) {
        return false;
      }
      return !entry.isSymbolicLink();
    });

    const nodes = await Promise.all(
      visibleEntries.map(async (entry) => {
        const entryPath = join(rootPath, entry.name);

        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: entryPath,
            type: "folder" as const,
            children: await this.readWorkspaceDirectoryTree(entryPath),
          };
        }

        const extension = extname(entry.name).replace(".", "");

        return {
          name: entry.name,
          path: entryPath,
          type: "file" as const,
          extension: extension || undefined,
        };
      }),
    );

    return nodes.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "folder" ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "zh-Hans-CN");
    });
  }
}
