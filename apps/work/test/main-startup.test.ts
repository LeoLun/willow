import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  app: {
    exit: vi.fn(),
    getPath: vi.fn(() => "/tmp/willow-app-data"),
    isPackaged: false,
    once: vi.fn(),
    setPath: vi.fn(),
  },
  prepareHotUpdateLaunch: vi.fn(() => undefined),
  protocol: {
    handle: vi.fn(),
    isProtocolHandled: vi.fn(() => false),
    registerSchemesAsPrivileged: vi.fn(),
  },
  startApplication: vi.fn(async () => undefined),
}));

vi.mock("electron", () => ({
  app: mocks.app,
  net: { fetch: vi.fn() },
  protocol: mocks.protocol,
}));

vi.mock("@main/update/hot-update-launcher", () => ({
  prepareHotUpdateLaunch: mocks.prepareHotUpdateLaunch,
}));

vi.mock("@main/application", () => ({
  startApplication: mocks.startApplication,
}));

describe("main process startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protocol.isProtocolHandled.mockReturnValue(false);
    vi.resetModules();
  });

  it("registers ready handling before initializing the application module", async () => {
    await import("@main/main");
    await vi.waitFor(() => expect(mocks.startApplication).toHaveBeenCalledOnce());

    expect(mocks.app.once).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(mocks.app.once.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.startApplication.mock.invocationCallOrder[0],
    );

    const readyHandler = mocks.app.once.mock.calls[0][1];
    readyHandler();

    expect(mocks.protocol.isProtocolHandled).toHaveBeenCalledWith("willow-file");
    expect(mocks.protocol.handle).toHaveBeenCalledWith("willow-file", expect.any(Function));
  });

  it("does not register the file protocol again when a hot-update entry also handles ready", async () => {
    await import("@main/main");
    await vi.waitFor(() => expect(mocks.startApplication).toHaveBeenCalledOnce());

    const readyHandler = mocks.app.once.mock.calls[0][1];
    mocks.protocol.isProtocolHandled.mockReturnValue(true);
    readyHandler();

    expect(mocks.protocol.isProtocolHandled).toHaveBeenCalledWith("willow-file");
    expect(mocks.protocol.handle).not.toHaveBeenCalled();
  });
});
