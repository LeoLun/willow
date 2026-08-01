import "reflect-metadata";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  app: {
    getLoginItemSettings: vi.fn(),
    getPath: vi.fn(),
    isPackaged: true,
    setLoginItemSettings: vi.fn(),
  },
}));

vi.mock("electron", () => ({ app: electronMocks.app }));

import { GetAutoLaunchController } from "../src/main/controllers/auto-launch/get.auto-launch.controller";
import { SetAutoLaunchController } from "../src/main/controllers/auto-launch/set.auto-launch.controller";
import { AutoLaunchService } from "../src/main/service/auto-launch.service";
import type { AutoLaunchState, SetAutoLaunchRequest } from "../src/shared/api";

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
const originalExecPath = Object.getOwnPropertyDescriptor(process, "execPath");
const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
const event = undefined as unknown as Electron.IpcMainInvokeEvent;

let testDirectory: string;

function setRuntime(platform: NodeJS.Platform, execPath = "/Applications/Willow.app/Willow") {
  Object.defineProperty(process, "platform", { configurable: true, value: platform });
  Object.defineProperty(process, "execPath", { configurable: true, value: execPath });
}

function loginItemSettings(
  overrides: Partial<Electron.LoginItemSettings> = {},
): Electron.LoginItemSettings {
  return {
    executableWillLaunchAtLogin: false,
    launchItems: [],
    openAsHidden: false,
    openAtLogin: false,
    restoreState: false,
    status: "not-registered",
    wasOpenedAsHidden: false,
    wasOpenedAtLogin: false,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  testDirectory = await mkdtemp(join(tmpdir(), "willow-auto-launch-"));
  electronMocks.app.isPackaged = true;
  electronMocks.app.getPath.mockReturnValue(testDirectory);
  electronMocks.app.getLoginItemSettings.mockReturnValue(loginItemSettings());
  delete process.env.XDG_CONFIG_HOME;
});

afterEach(async () => {
  if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
  if (originalExecPath) Object.defineProperty(process, "execPath", originalExecPath);
  if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
  await rm(testDirectory, { force: true, recursive: true });
});

describe("AutoLaunchService", () => {
  it("reports development builds as unsupported without changing the system", async () => {
    setRuntime("darwin");
    electronMocks.app.isPackaged = false;

    const service = new AutoLaunchService();

    await expect(service.setEnabled(true)).resolves.toEqual({
      enabled: false,
      requiresApproval: false,
      supported: false,
    });
    expect(electronMocks.app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it("reads and updates the macOS login item", async () => {
    setRuntime("darwin");
    electronMocks.app.getLoginItemSettings
      .mockReturnValueOnce(loginItemSettings())
      .mockReturnValueOnce(loginItemSettings({ openAtLogin: true, status: "enabled" }));

    const state = await new AutoLaunchService().setEnabled(true);

    expect(electronMocks.app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    expect(state).toEqual({ enabled: true, requiresApproval: false, supported: true });
  });

  it("removes the macOS login item", async () => {
    setRuntime("darwin");
    electronMocks.app.getLoginItemSettings
      .mockReturnValueOnce(loginItemSettings({ openAtLogin: true, status: "enabled" }))
      .mockReturnValueOnce(loginItemSettings());

    await expect(new AutoLaunchService().setEnabled(false)).resolves.toMatchObject({
      enabled: false,
    });
    expect(electronMocks.app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
  });

  it("reports when macOS requires user approval", async () => {
    setRuntime("darwin");
    electronMocks.app.getLoginItemSettings.mockReturnValue(
      loginItemSettings({ openAtLogin: true, status: "requires-approval" }),
    );

    await expect(new AutoLaunchService().getState()).resolves.toEqual({
      enabled: false,
      requiresApproval: true,
      supported: true,
    });
  });

  it("uses the stable Squirrel launcher when updating Windows", async () => {
    setRuntime("win32", "C:\\Users\\me\\AppData\\Local\\Willow\\app-1.0.4\\Willow.exe");
    electronMocks.app.getLoginItemSettings
      .mockReturnValueOnce(loginItemSettings())
      .mockReturnValueOnce(loginItemSettings({ executableWillLaunchAtLogin: true }));

    const state = await new AutoLaunchService().setEnabled(true);
    const expectedPath = "C:\\Users\\me\\AppData\\Local\\Willow\\Willow.exe";

    expect(electronMocks.app.setLoginItemSettings).toHaveBeenCalledWith({
      enabled: true,
      openAtLogin: true,
      path: expectedPath,
    });
    expect(electronMocks.app.getLoginItemSettings).toHaveBeenLastCalledWith({
      path: expectedPath,
    });
    expect(state.enabled).toBe(true);
  });

  it("disables the Windows startup-approved registry entry", async () => {
    setRuntime("win32", "C:\\Users\\me\\AppData\\Local\\Willow\\app-1.0.4\\Willow.exe");
    electronMocks.app.getLoginItemSettings
      .mockReturnValueOnce(loginItemSettings({ executableWillLaunchAtLogin: true }))
      .mockReturnValueOnce(loginItemSettings());

    await expect(new AutoLaunchService().setEnabled(false)).resolves.toMatchObject({
      enabled: false,
    });
    expect(electronMocks.app.setLoginItemSettings).toHaveBeenCalledWith({
      enabled: false,
      openAtLogin: false,
      path: "C:\\Users\\me\\AppData\\Local\\Willow\\Willow.exe",
    });
  });

  it("creates, reads, and removes an XDG autostart entry on Linux", async () => {
    const execPath = '/opt/Willow $100/"bin"/Willow';
    setRuntime("linux", execPath);
    process.env.XDG_CONFIG_HOME = testDirectory;
    const service = new AutoLaunchService();
    const filePath = join(testDirectory, "autostart", "willow.desktop");

    await expect(service.getState()).resolves.toMatchObject({ enabled: false, supported: true });
    await expect(service.setEnabled(true)).resolves.toMatchObject({ enabled: true });
    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain('Exec="/opt/Willow \\$100/\\"bin\\"/Willow"');

    await expect(service.setEnabled(false)).resolves.toMatchObject({ enabled: false });
    await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("treats a desktop entry disabled by the environment as off", async () => {
    setRuntime("linux", "/opt/Willow/Willow");
    process.env.XDG_CONFIG_HOME = testDirectory;
    const autostartDirectory = join(testDirectory, "autostart");
    await mkdir(autostartDirectory);
    await writeFile(
      join(autostartDirectory, "willow.desktop"),
      '[Desktop Entry]\nExec="/opt/Willow/Willow"\nHidden=true\n',
    );

    await expect(new AutoLaunchService().getState()).resolves.toMatchObject({ enabled: false });
  });

  it("propagates Linux filesystem failures", async () => {
    setRuntime("linux", "/opt/Willow/Willow");
    process.env.XDG_CONFIG_HOME = testDirectory;
    await writeFile(join(testDirectory, "autostart"), "not a directory");

    await expect(new AutoLaunchService().setEnabled(true)).rejects.toBeDefined();
  });
});

describe("auto-launch IPC controllers", () => {
  const enabledState: AutoLaunchState = {
    enabled: true,
    requiresApproval: false,
    supported: true,
  };
  const getState = vi.fn<AutoLaunchService["getState"]>();
  const setEnabled = vi.fn<AutoLaunchService["setEnabled"]>();
  const service = { getState, setEnabled } as unknown as AutoLaunchService;

  beforeEach(() => {
    getState.mockResolvedValue(enabledState);
    setEnabled.mockResolvedValue(enabledState);
  });

  it("returns the current state", async () => {
    await expect(new GetAutoLaunchController(service).run(event, {})).resolves.toEqual({
      code: 0,
      data: enabledState,
      msg: "ok",
    });
  });

  it("validates and delegates state changes", async () => {
    const controller = new SetAutoLaunchController(service);

    await expect(controller.run(event, { enabled: true })).resolves.toEqual({
      code: 0,
      data: enabledState,
      msg: "ok",
    });
    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it.each([undefined, {}, { enabled: "yes" }])("rejects invalid input", async (request) => {
    const response = await new SetAutoLaunchController(service).run(
      event,
      request as unknown as SetAutoLaunchRequest,
    );

    expect(response.code).toBe(400);
    expect(setEnabled).not.toHaveBeenCalled();
  });

  it("propagates service failures", async () => {
    setEnabled.mockRejectedValueOnce(new Error("system failure"));

    await expect(
      new SetAutoLaunchController(service).run(event, { enabled: false }),
    ).rejects.toThrow("system failure");
  });
});
