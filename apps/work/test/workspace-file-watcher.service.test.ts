import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const watcherMocks = vi.hoisted(() => {
  const watchers: FakeWatcher[] = [];
  class FakeWatcher {
    readonly close = vi.fn(async () => undefined);
    private allListener?: (event: string, path: string) => void;

    on(event: string, listener: (event: string, path: string) => void) {
      if (event === "all") this.allListener = listener;
      return this;
    }

    emit(event: string, path: string) {
      this.allListener?.(event, path);
    }
  }

  return {
    FakeWatcher,
    watch: vi.fn(() => {
      const watcher = new FakeWatcher();
      watchers.push(watcher);
      return watcher;
    }),
    watchers,
  };
});

vi.mock("chokidar", () => ({ watch: watcherMocks.watch }));

import type { EventService } from "../src/main/service/event.service";
import type { FileSearchService } from "../src/main/service/file-search.service";
import { WorkspaceFileWatcherService } from "../src/main/service/workspace-file-watcher.service";
import type { WorkspaceService } from "../src/main/service/workspace.service";
import { WORKSPACE_FILES_CHANGED_EVENT } from "../src/shared/constants";

class FakeWebContents extends EventEmitter {
  constructor(readonly id: number) {
    super();
  }
}

function createService() {
  const eventService = { sendEvent: vi.fn() } as unknown as EventService;
  const fileSearchService = { invalidateWorkspace: vi.fn() } as unknown as FileSearchService;
  const workspaceService = {
    getWorkspaceDetail: vi.fn((workspaceId: number) => ({
      id: workspaceId,
      path: `/workspace-${workspaceId}`,
    })),
  } as unknown as WorkspaceService;
  return {
    eventService,
    fileSearchService,
    service: new WorkspaceFileWatcherService(eventService, fileSearchService, workspaceService),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  watcherMocks.watchers.splice(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WorkspaceFileWatcherService", () => {
  it("shares one watcher, batches events, and invalidates search caches", async () => {
    const { eventService, fileSearchService, service } = createService();
    const first = new FakeWebContents(1) as unknown as WebContents;
    const second = new FakeWebContents(2) as unknown as WebContents;

    await service.subscribe(7, "tab-a", first);
    await service.subscribe(7, "tab-b", second);
    await service.subscribe(7, "tab-a", first);
    expect(watcherMocks.watch).toHaveBeenCalledTimes(1);

    watcherMocks.watchers[0]?.emit("change", "/workspace-7/src/main.ts");
    watcherMocks.watchers[0]?.emit("add", "/workspace-7/src/new.ts");
    expect(fileSearchService.invalidateWorkspace).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);

    expect(eventService.sendEvent).toHaveBeenCalledWith(WORKSPACE_FILES_CHANGED_EVENT, {
      changes: [
        { relativePath: "src/main.ts", type: "change" },
        { relativePath: "src/new.ts", type: "add" },
      ],
      workspaceId: 7,
    });

    await service.unsubscribe("tab-a", first);
    expect(watcherMocks.watchers[0]?.close).not.toHaveBeenCalled();
    await service.unsubscribe("tab-b", second);
    expect(watcherMocks.watchers[0]?.close).toHaveBeenCalledOnce();
  });

  it("cleans subscriptions when WebContents is destroyed and on shutdown", async () => {
    const { service } = createService();
    const first = new FakeWebContents(1);
    const second = new FakeWebContents(2);

    await service.subscribe(1, "tab", first as unknown as WebContents);
    first.emit("destroyed");
    await vi.waitFor(() => expect(watcherMocks.watchers[0]?.close).toHaveBeenCalledOnce());

    await service.subscribe(1, "tab", second as unknown as WebContents);
    await service.subscribe(2, "tab-two", second as unknown as WebContents);
    await service.closeAll();
    expect(watcherMocks.watchers.at(-1)?.close).toHaveBeenCalledOnce();
  });
});
