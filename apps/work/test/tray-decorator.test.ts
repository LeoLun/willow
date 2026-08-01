import "reflect-metadata";
import {
  CoreFactoryStatic,
  Module,
  On,
  Tray,
  TrayFactoryResolver,
  TrayInstance,
  type OnDestroy,
  type OnInit,
} from "@willow/poetry";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  beforeQuit: undefined as (() => void) | undefined,
  image: { setTemplateImage: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  trays: [] as Array<{
    destroy: ReturnType<typeof vi.fn>;
    emit: (event: string) => void;
    isDestroyed: ReturnType<typeof vi.fn>;
    listeners: Map<string, (...args: unknown[]) => void>;
    on: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  Tray: class {
    destroyed = false;
    destroy = vi.fn(() => {
      this.destroyed = true;
    });
    isDestroyed = vi.fn(() => this.destroyed);
    listeners = new Map<string, (...args: unknown[]) => void>();
    on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      this.listeners.set(event, callback);
    });

    constructor(
      public image: unknown,
      public guid?: string,
    ) {
      electronMocks.trays.push(this);
    }

    emit(event: string) {
      this.listeners.get(event)?.();
    }
  },
  app: {
    on: vi.fn(),
    once: vi.fn((event: string, callback: () => void) => {
      if (event === "before-quit") electronMocks.beforeQuit = callback;
    }),
  },
  ipcMain: electronMocks.ipcMain,
  nativeImage: {
    createFromPath: vi.fn(() => electronMocks.image),
  },
  shell: { openExternal: vi.fn() },
}));

@Tray({ image: "/tmp/tray.png", guid: "willow-tray", templateImage: true })
class TestTray implements OnInit, OnDestroy {
  @TrayInstance()
  nativeTray!: Electron.Tray;

  initialized = false;
  destroyed = false;
  clicks = 0;

  onInit() {
    this.initialized = true;
  }

  onDestroy() {
    this.destroyed = true;
  }

  @On("click")
  onClick() {
    this.clicks += 1;
  }
}

@Module({ trays: [TestTray] })
class TrayTestModule {
  constructor(public readonly trayFactoryResolver: TrayFactoryResolver) {}
}

describe("Tray decorator", () => {
  beforeEach(() => {
    electronMocks.beforeQuit = undefined;
    electronMocks.trays.length = 0;
    vi.clearAllMocks();
  });

  it("creates and injects a native tray through the module resolver", async () => {
    const module = await new CoreFactoryStatic().create(TrayTestModule);
    const trayController = module.trayFactoryResolver.resolveTrayFactory(TestTray);

    expect(electronMocks.trays).toHaveLength(1);
    expect(electronMocks.image.setTemplateImage).toHaveBeenCalledWith(true);
    expect(electronMocks.trays[0]).toMatchObject({
      guid: "willow-tray",
      image: electronMocks.image,
    });
    expect(trayController.nativeTray).toBe(electronMocks.trays[0]);
    expect(trayController.initialized).toBe(true);

    electronMocks.trays[0].emit("click");
    expect(trayController.clicks).toBe(1);
  });

  it("runs destruction lifecycle and destroys the native tray before quitting", async () => {
    const module = await new CoreFactoryStatic().create(TrayTestModule);
    const trayController = module.trayFactoryResolver.resolveTrayFactory(TestTray);

    electronMocks.beforeQuit?.();

    await vi.waitFor(() => expect(electronMocks.trays[0].destroy).toHaveBeenCalledOnce());
    expect(trayController.destroyed).toBe(true);
  });
});
