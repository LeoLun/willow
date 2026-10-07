import "reflect-metadata";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ home: "", openPath: vi.fn() }));
vi.mock("node:os", async (original) => {
  const os = await original<typeof import("node:os")>();
  return { ...os, homedir: () => mocks.home || os.homedir() };
});
vi.mock("electron", () => ({ shell: { openPath: mocks.openPath } }));

import { OpenMemoryController } from "../src/main/controllers/memory/open.memory.controller";
import { ReadMemoryController } from "../src/main/controllers/memory/read.memory.controller";
import { SaveMemoryController } from "../src/main/controllers/memory/save.memory.controller";
import { SetMemoryEnabledController } from "../src/main/controllers/memory/set-enabled.memory.controller";
import { MemoryService } from "../src/main/service/memory.service";
import {
  WorkspaceNotFoundError,
  type WorkspaceService,
} from "../src/main/service/workspace.service";
import type { MemoryFileRequest } from "../src/shared/api";

let root: string;
let workspacePath: string;
const getWorkspaceDetail = vi.fn();
let service: MemoryService;
const event = {} as Electron.IpcMainInvokeEvent;
beforeEach(async () => {
  vi.clearAllMocks();
  root = await realpath(await mkdtemp(join(tmpdir(), "willow-app-memory-")));
  mocks.home = join(root, "home");
  workspacePath = join(root, "workspace");
  await Promise.all([mkdir(mocks.home), mkdir(workspacePath)]);
  getWorkspaceDetail.mockImplementation((id) => {
    if (id !== 1) throw new WorkspaceNotFoundError(id);
    return { path: workspacePath };
  });
  mocks.openPath.mockResolvedValue("");
  service = new MemoryService({ getWorkspaceDetail } as unknown as WorkspaceService);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  mocks.home = "";
});

describe("MemoryService", () => {
  it("resolves only fixed global/project paths and reading creates nothing", async () => {
    expect(await service.read({ scope: "global" })).toMatchObject({
      exists: false,
      path: join(mocks.home, ".willow/memory/MEMORY.md"),
    });
    expect(getWorkspaceDetail).not.toHaveBeenCalled();
    expect(await service.read({ scope: "project", workspaceId: 1 })).toMatchObject({
      exists: false,
      path: join(workspacePath, ".willow/memory/MEMORY.md"),
    });
    expect(await readdir(workspacePath)).toEqual([]);
    expect(mocks.openPath).not.toHaveBeenCalled();
  });
  it("creates defaults on explicit open and preserves existing external edits", async () => {
    await service.open({ scope: "project", workspaceId: 1 });
    const path = join(workspacePath, ".willow/memory/MEMORY.md");
    expect(mocks.openPath).toHaveBeenCalledWith(path);
    expect(await readFile(path, "utf8")).toContain("## Architecture");
    await writeFile(path, "# External edit");
    await service.open({ scope: "project", workspaceId: 1 });
    expect((await service.read({ scope: "project", workspaceId: 1 })).content).toBe(
      "# External edit",
    );
  });
  it("propagates missing workspace and native open failures", async () => {
    await expect(service.read({ scope: "project", workspaceId: 2 })).rejects.toThrow(
      "Workspace not found",
    );
    await expect(service.open({ scope: "project", workspaceId: 2 })).rejects.toThrow(
      "Workspace not found",
    );
    expect(mocks.openPath).not.toHaveBeenCalled();
    mocks.openPath.mockResolvedValueOnce("No application available");
    await expect(service.open({ scope: "global" })).rejects.toThrow("No application available");
  });
  it("refuses symlink redirection before native open", async () => {
    await symlink(mocks.home, join(workspacePath, ".willow"));
    await expect(service.open({ scope: "project", workspaceId: 1 })).rejects.toThrow("symlink");
    expect(mocks.openPath).not.toHaveBeenCalled();
  });
});

describe("memory controllers", () => {
  it("delegates valid requests and returns success", async () => {
    const request = { scope: "project", workspaceId: 1 } as const;
    const snapshot = await service.read(request);
    const read = vi.spyOn(service, "read").mockResolvedValue(snapshot);
    expect(await new ReadMemoryController(service).run(event, request)).toEqual({
      code: 0,
      msg: "ok",
      data: { memory: snapshot },
    });
    expect(read).toHaveBeenCalledWith(request);
    const open = vi.spyOn(service, "open").mockResolvedValue();
    expect(await new OpenMemoryController(service).run(event, request)).toEqual({
      code: 0,
      msg: "ok",
      data: {},
    });
    expect(open).toHaveBeenCalledWith(request);
  });
  it.each([
    undefined,
    {},
    { scope: "bad" },
    { scope: "project", workspaceId: 0 },
    { scope: "project", workspaceId: "1" },
    { scope: "global", workspaceId: 1 },
    { scope: "global", path: "/outside" },
    { scope: "project", workspaceId: 1, content: "forged" },
  ])("rejects invalid input %j without service calls", async (request) => {
    const read = vi.spyOn(service, "read");
    const open = vi.spyOn(service, "open");
    expect(
      await new ReadMemoryController(service).run(event, request as MemoryFileRequest),
    ).toMatchObject({ code: 400 });
    expect(
      await new OpenMemoryController(service).run(event, request as MemoryFileRequest),
    ).toMatchObject({ code: 400 });
    expect(read).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it("propagates service failures", async () => {
    vi.spyOn(service, "read").mockRejectedValueOnce(new Error("read failed"));
    vi.spyOn(service, "open").mockRejectedValueOnce(new Error("open failed"));
    await expect(new ReadMemoryController(service).run(event, { scope: "global" })).rejects.toThrow(
      "read failed",
    );
    await expect(new OpenMemoryController(service).run(event, { scope: "global" })).rejects.toThrow(
      "open failed",
    );
  });
});

describe("memory saves", () => {
  it("saves only the selected workspace and detects conflicting updates", async () => {
    const request = {
      scope: "project",
      workspaceId: 1,
      content: "记忆",
      expectedContent: null,
    } as const;
    const controller = new SaveMemoryController(service);
    expect(await controller.run(event, request)).toMatchObject({ code: 0 });
    expect((await service.read(request)).content).toBe("记忆");
    await expect(service.save({ ...request, content: "overwrite" })).rejects.toThrow("已被更新");
    expect(mocks.openPath).not.toHaveBeenCalled();
  });
  it.each([
    { scope: "global", content: "", expectedContent: null, path: "/tmp/escape" },
    { scope: "global", content: 3, expectedContent: null },
    { scope: "global", content: "" },
    { scope: "project", workspaceId: -1, content: "", expectedContent: null },
  ])("rejects invalid save input %j", (request) => {
    expect(new SaveMemoryController(service).checkParams(request as never)).toBeInstanceOf(Error);
  });
});

describe("memory enabled controller", () => {
  it("persists the global switch without creating memory documents", async () => {
    const controller = new SetMemoryEnabledController(service);
    expect(await controller.run(event, { enabled: false })).toMatchObject({
      code: 0,
      data: { enabled: false },
    });
    expect(await service.read({ scope: "global" })).toMatchObject({
      enabled: false,
      exists: false,
    });
    await service.setEnabled(true);
    expect((await service.read({ scope: "global" })).enabled).toBe(true);
  });
  it.each([null, {}, { enabled: "false" }, { enabled: false, path: "/escape" }])(
    "rejects %j",
    (request) => {
      expect(new SetMemoryEnabledController(service).checkParams(request as never)).toBeInstanceOf(
        Error,
      );
    },
  );
});
