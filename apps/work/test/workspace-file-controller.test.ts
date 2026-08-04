import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListWorkspaceDirectoryController } from "../src/main/controllers/file-search/list-directory.file-search.controller";
import { OpenWorkspaceFileController } from "../src/main/controllers/file-search/open-file.file-search.controller";
import { ReadWorkspaceFileController } from "../src/main/controllers/file-search/read-file.file-search.controller";
import { RevealWorkspaceEntryController } from "../src/main/controllers/file-search/reveal-entry.file-search.controller";
import { SubscribeWorkspaceFilesController } from "../src/main/controllers/file-search/subscribe.file-search.controller";
import { UnsubscribeWorkspaceFilesController } from "../src/main/controllers/file-search/unsubscribe.file-search.controller";
import {
  InvalidWorkspaceFilePathError,
  WorkspaceFileNotFoundError,
  type FileSearchService,
} from "../src/main/service/file-search.service";
import type { WorkspaceFileWatcherService } from "../src/main/service/workspace-file-watcher.service";

const mocks = vi.hoisted(() => ({
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  shell: { openPath: mocks.openPath, showItemInFolder: mocks.showItemInFolder },
}));

const sender = { id: 42 } as Electron.WebContents;
const event = { sender } as Electron.IpcMainInvokeEvent;
const listDirectory = vi.fn<FileSearchService["listDirectory"]>();
const readWorkspaceFile = vi.fn<FileSearchService["readWorkspaceFile"]>();
const resolveWorkspaceFilePath = vi.fn<FileSearchService["resolveWorkspaceFilePath"]>();
const resolveWorkspaceEntryPath = vi.fn<FileSearchService["resolveWorkspaceEntryPath"]>();
const subscribe = vi.fn<WorkspaceFileWatcherService["subscribe"]>();
const unsubscribe = vi.fn<WorkspaceFileWatcherService["unsubscribe"]>();
const fileService = {
  listDirectory,
  readWorkspaceFile,
  resolveWorkspaceEntryPath,
  resolveWorkspaceFilePath,
} as unknown as FileSearchService;
const watcherService = { subscribe, unsubscribe } as unknown as WorkspaceFileWatcherService;

const listController = new ListWorkspaceDirectoryController(fileService);
const readController = new ReadWorkspaceFileController(fileService);
const openController = new OpenWorkspaceFileController(fileService);
const revealController = new RevealWorkspaceEntryController(fileService);
const subscribeController = new SubscribeWorkspaceFilesController(watcherService);
const unsubscribeController = new UnsubscribeWorkspaceFilesController(watcherService);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("workspace file controllers", () => {
  it("delegates directory listing and file reading", async () => {
    listDirectory.mockResolvedValueOnce({ entries: [], nextCursor: "next" });
    readWorkspaceFile.mockResolvedValueOnce({
      content: "hello",
      modifiedAt: 1,
      name: "a.txt",
      relativePath: "a.txt",
      size: 5,
      status: "ready",
    });

    await expect(
      listController.run(event, { workspaceId: 1, directoryPath: "src", limit: 100 }),
    ).resolves.toEqual({
      code: 0,
      data: { entries: [], nextCursor: "next" },
      msg: "ok",
    });
    expect(listDirectory).toHaveBeenCalledWith(1, "src", undefined, 100);

    await expect(
      readController.run(event, { workspaceId: 1, relativePath: "a.txt" }),
    ).resolves.toMatchObject({ code: 0, data: { file: { content: "hello" } } });
    expect(readWorkspaceFile).toHaveBeenCalledWith(1, "a.txt");
  });

  it("opens a validated workspace file with the system shell", async () => {
    resolveWorkspaceFilePath.mockResolvedValueOnce("/workspace/a.dat");
    mocks.openPath.mockResolvedValueOnce("");

    await expect(
      openController.run(event, { workspaceId: 1, relativePath: "a.dat" }),
    ).resolves.toEqual({ code: 0, data: {}, msg: "ok" });
    expect(resolveWorkspaceFilePath).toHaveBeenCalledWith(1, "a.dat");
    expect(mocks.openPath).toHaveBeenCalledWith("/workspace/a.dat");
  });

  it.each([
    ["file", "src/main.ts", "/workspace/src/main.ts"],
    ["directory", "src", "/workspace/src"],
  ])("reveals a validated workspace %s with the system shell", async (_, relativePath, path) => {
    resolveWorkspaceEntryPath.mockResolvedValueOnce(path);

    await expect(revealController.run(event, { workspaceId: 1, relativePath })).resolves.toEqual({
      code: 0,
      data: {},
      msg: "ok",
    });
    expect(resolveWorkspaceEntryPath).toHaveBeenCalledWith(1, relativePath);
    expect(mocks.showItemInFolder).toHaveBeenCalledWith(path);
  });

  it("validates input without calling services", async () => {
    await expect(
      listController.run(event, { workspaceId: 1, directoryPath: "", limit: 201 }),
    ).resolves.toEqual({ code: 400, msg: "limit must be an integer between 1 and 200" });
    await expect(readController.run(event, { workspaceId: 1, relativePath: "" })).resolves.toEqual({
      code: 400,
      msg: "relativePath must be a non-empty string",
    });
    await expect(openController.run(event, { workspaceId: 1, relativePath: "" })).resolves.toEqual({
      code: 400,
      msg: "relativePath must be a non-empty string",
    });
    await expect(
      revealController.run(event, { workspaceId: 1, relativePath: "" }),
    ).resolves.toEqual({
      code: 400,
      msg: "relativePath must be a non-empty string",
    });
    await expect(
      revealController.run(event, { workspaceId: 0, relativePath: "src" }),
    ).resolves.toEqual({
      code: 400,
      msg: "workspaceId must be a positive integer",
    });
    await expect(
      revealController.run(event, { workspaceId: 1, relativePath: "a".repeat(4_097) }),
    ).resolves.toEqual({
      code: 400,
      msg: "relativePath must not exceed 4096 characters",
    });
    await expect(
      subscribeController.run(event, { workspaceId: 1, subscriptionId: "" }),
    ).resolves.toEqual({ code: 400, msg: "subscriptionId must be a non-empty string" });
    expect(listDirectory).not.toHaveBeenCalled();
    expect(readWorkspaceFile).not.toHaveBeenCalled();
    expect(resolveWorkspaceFilePath).not.toHaveBeenCalled();
    expect(resolveWorkspaceEntryPath).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("maps invalid and missing paths", async () => {
    listDirectory.mockRejectedValueOnce(new InvalidWorkspaceFilePathError("../"));
    readWorkspaceFile.mockRejectedValueOnce(new WorkspaceFileNotFoundError("missing.txt"));

    await expect(
      listController.run(event, { workspaceId: 1, directoryPath: "../" }),
    ).resolves.toMatchObject({ code: 400 });
    await expect(
      readController.run(event, { workspaceId: 1, relativePath: "missing.txt" }),
    ).resolves.toMatchObject({ code: 404 });

    resolveWorkspaceFilePath.mockRejectedValueOnce(new InvalidWorkspaceFilePathError("../"));
    await expect(
      openController.run(event, { workspaceId: 1, relativePath: "../" }),
    ).resolves.toMatchObject({ code: 400 });

    resolveWorkspaceEntryPath.mockRejectedValueOnce(new WorkspaceFileNotFoundError("missing"));
    await expect(
      revealController.run(event, { workspaceId: 1, relativePath: "missing" }),
    ).resolves.toMatchObject({ code: 404 });

    resolveWorkspaceEntryPath.mockRejectedValueOnce(new InvalidWorkspaceFilePathError("../"));
    await expect(
      revealController.run(event, { workspaceId: 1, relativePath: "../" }),
    ).resolves.toMatchObject({ code: 400 });
  });

  it("propagates system shell errors when opening a workspace file", async () => {
    resolveWorkspaceFilePath.mockResolvedValueOnce("/workspace/a.dat");
    mocks.openPath.mockResolvedValueOnce("No application is registered");

    await expect(
      openController.run(event, { workspaceId: 1, relativePath: "a.dat" }),
    ).rejects.toThrow("No application is registered");
  });

  it("subscribes and unsubscribes with the invoking WebContents", async () => {
    subscribe.mockResolvedValueOnce(undefined);
    unsubscribe.mockResolvedValueOnce(undefined);

    await expect(
      subscribeController.run(event, { workspaceId: 3, subscriptionId: "tab-a" }),
    ).resolves.toEqual({ code: 0, data: {}, msg: "ok" });
    expect(subscribe).toHaveBeenCalledWith(3, "tab-a", sender);

    await expect(unsubscribeController.run(event, { subscriptionId: "tab-a" })).resolves.toEqual({
      code: 0,
      data: {},
      msg: "ok",
    });
    expect(unsubscribe).toHaveBeenCalledWith("tab-a", sender);
  });
});
