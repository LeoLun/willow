import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn((template) => ({ template })),
  quit: vi.fn(),
}));

vi.mock("electron", () => ({
  Tray: class Tray {},
  app: {
    quit: mocks.quit,
  },
  Menu: {
    buildFromTemplate: mocks.buildFromTemplate,
  },
}));

vi.mock("../src/main/window/main.window", () => ({
  MainWindow: class MainWindow {},
}));

import type { WindowFactoryResolver } from "@willow/poetry";
import type { Tray } from "electron";
import { createMenuBarTemplate, MacMenuBar } from "../src/main/menu-bar";

describe("macOS menu bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the two menu actions in the expected order", () => {
    const showMainWindow = vi.fn();
    const quitApplication = vi.fn();
    const template = createMenuBarTemplate(showMainWindow, quitApplication);

    expect(template.map((item) => item.label)).toEqual(["显示主窗口", "退出"]);

    Reflect.apply(template[0].click as (...args: unknown[]) => void, undefined, []);
    Reflect.apply(template[1].click as (...args: unknown[]) => void, undefined, []);

    expect(showMainWindow).toHaveBeenCalledOnce();
    expect(quitApplication).toHaveBeenCalledOnce();
  });

  it("configures the injected tray and menu actions", () => {
    const window = {
      focus: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      show: vi.fn(),
    };
    const resolveWindowFactory = vi.fn(() => ({ win: window }));
    const menuBar = new MacMenuBar({ resolveWindowFactory } as unknown as WindowFactoryResolver);
    const tray = {
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
    } as unknown as Tray;
    menuBar.tray = tray;

    menuBar.onInit();

    expect(tray.setToolTip).toHaveBeenCalledWith("Willow");
    expect(tray.setContextMenu).toHaveBeenCalledOnce();
    const contextMenu = vi.mocked(tray.setContextMenu).mock.calls[0][0] as unknown as {
      template: ReturnType<typeof createMenuBarTemplate>;
    };
    Reflect.apply(contextMenu.template[0].click as (...args: unknown[]) => void, undefined, []);
    Reflect.apply(contextMenu.template[1].click as (...args: unknown[]) => void, undefined, []);

    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(mocks.quit).toHaveBeenCalledOnce();
  });
});
