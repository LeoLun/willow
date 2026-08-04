import { relative } from "node:path";
import type { WorkspaceFileChange, WorkspaceFileChangeType } from "@shared/api";
import { WORKSPACE_FILES_CHANGED_EVENT } from "@shared/constants";
import { Injectable } from "@willow/poetry";
import { watch, type FSWatcher } from "chokidar";
import type { WebContents } from "electron";
import { EventService } from "./event.service";
import { FileSearchService } from "./file-search.service";
import { WorkspaceService } from "./workspace.service";

const EVENT_BATCH_DELAY_MS = 100;
const WATCHED_EVENTS = new Set<WorkspaceFileChangeType>([
  "add",
  "change",
  "unlink",
  "addDir",
  "unlinkDir",
]);

type WorkspaceWatcher = {
  changes: Map<string, WorkspaceFileChangeType>;
  flushTimer?: ReturnType<typeof setTimeout>;
  subscribers: Set<string>;
  watcher: FSWatcher;
  workspacePath: string;
};

type Subscription = {
  destroyedListener: () => void;
  webContents: WebContents;
  workspaceId: number;
};

@Injectable()
export class WorkspaceFileWatcherService {
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly watchers = new Map<number, WorkspaceWatcher>();

  constructor(
    private readonly eventService: EventService,
    private readonly fileSearchService: FileSearchService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async subscribe(workspaceId: number, subscriptionId: string, webContents: WebContents) {
    const key = subscriptionKey(webContents.id, subscriptionId);
    const current = this.subscriptions.get(key);
    if (current?.workspaceId === workspaceId) return;
    if (current) await this.unsubscribeByKey(key);

    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    let state = this.watchers.get(workspaceId);
    if (!state || state.workspacePath !== workspace.path) {
      if (state) await this.closeWatcher(workspaceId, state);
      state = this.createWatcher(workspaceId, workspace.path);
      this.watchers.set(workspaceId, state);
    }

    const destroyedListener = () => {
      void this.unsubscribeByKey(key);
    };
    this.subscriptions.set(key, { destroyedListener, webContents, workspaceId });
    state.subscribers.add(key);
    webContents.once("destroyed", destroyedListener);
  }

  async unsubscribe(subscriptionId: string, webContents: WebContents): Promise<void> {
    await this.unsubscribeByKey(subscriptionKey(webContents.id, subscriptionId));
  }

  async closeAll(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      subscription.webContents.off("destroyed", subscription.destroyedListener);
    }
    this.subscriptions.clear();
    await Promise.all(
      [...this.watchers.entries()].map(([workspaceId, state]) =>
        this.closeWatcher(workspaceId, state),
      ),
    );
  }

  private createWatcher(workspaceId: number, workspacePath: string): WorkspaceWatcher {
    const state: WorkspaceWatcher = {
      changes: new Map(),
      subscribers: new Set(),
      watcher: watch(workspacePath, {
        awaitWriteFinish: { pollInterval: 10, stabilityThreshold: 75 },
        followSymlinks: false,
        ignoreInitial: true,
        ignored: (path, stats) =>
          /(^|[/\\])(\.git|node_modules)([/\\]|$)/.test(path) ||
          path.endsWith(".codegraph/daemon.sock") ||
          Boolean(stats && !stats.isFile() && !stats.isDirectory()),
      }),
      workspacePath,
    };
    state.watcher.on("all", (event, path) => {
      if (!WATCHED_EVENTS.has(event as WorkspaceFileChangeType)) return;
      this.queueChange(workspaceId, state, event as WorkspaceFileChangeType, path);
    });
    state.watcher.on("error", (error) => {
      console.error("工作区文件监听失败:", error);
    });
    return state;
  }

  private queueChange(
    workspaceId: number,
    state: WorkspaceWatcher,
    type: WorkspaceFileChangeType,
    absolutePath: string,
  ): void {
    const relativePath = relative(state.workspacePath, absolutePath).split("\\").join("/");
    if (!relativePath || relativePath.startsWith("../") || /[\r\n]/.test(relativePath)) return;

    state.changes.set(relativePath, type);
    this.fileSearchService.invalidateWorkspace(workspaceId);
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(
      () => this.flushChanges(workspaceId, state),
      EVENT_BATCH_DELAY_MS,
    );
  }

  private flushChanges(workspaceId: number, state: WorkspaceWatcher): void {
    state.flushTimer = undefined;
    if (state.changes.size === 0 || state.subscribers.size === 0) {
      state.changes.clear();
      return;
    }

    const changes: WorkspaceFileChange[] = [...state.changes].map(([relativePath, type]) => ({
      relativePath,
      type,
    }));
    state.changes.clear();
    this.eventService.sendEvent(WORKSPACE_FILES_CHANGED_EVENT, { changes, workspaceId });
  }

  private async unsubscribeByKey(key: string): Promise<void> {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;

    this.subscriptions.delete(key);
    subscription.webContents.off("destroyed", subscription.destroyedListener);
    const state = this.watchers.get(subscription.workspaceId);
    state?.subscribers.delete(key);
    if (state && state.subscribers.size === 0) {
      await this.closeWatcher(subscription.workspaceId, state);
    }
  }

  private async closeWatcher(workspaceId: number, state: WorkspaceWatcher): Promise<void> {
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.changes.clear();
    if (this.watchers.get(workspaceId) === state) this.watchers.delete(workspaceId);
    await state.watcher.close();
  }
}

function subscriptionKey(webContentsId: number, subscriptionId: string): string {
  return `${webContentsId}:${subscriptionId}`;
}
