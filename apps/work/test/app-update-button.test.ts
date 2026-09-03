// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";

const mocks = vi.hoisted(() => ({
  state: {
    __v_isRef: true,
    value: { status: "hotAvailable", currentVersion: "1.0.0", latestVersion: "1.0.1", progress: 0 },
  },
  visible: { __v_isRef: true, value: true },
  downloadUpdate: vi.fn(),
  restartToUpdate: vi.fn(),
  openManualUpdate: vi.fn(),
  openDialog: vi.fn(),
  hasRunningSessions: { __v_isRef: true, value: false },
}));

vi.mock("../src/renderer/src/composables/useAppUpdate", () => ({
  useAppUpdate: () => mocks,
}));
vi.mock("../src/renderer/src/composables/useMessage", () => ({
  useMessageStatus: () => ({ hasRunningSessions: mocks.hasRunningSessions }),
}));
vi.mock("../src/renderer/src/components/dialog", () => ({
  useDialog: () => ({ openDialog: mocks.openDialog }),
}));

import AppUpdateButton from "../src/renderer/src/components/layout/AppUpdateButton.vue";

const mountedApps: Array<ReturnType<typeof createApp>> = [];

function mountButton() {
  const container = document.createElement("div");
  const app = createApp(AppUpdateButton);
  app.mount(container);
  mountedApps.push(app);
  return container;
}

beforeEach(() => {
  mocks.visible.value = true;
  mocks.hasRunningSessions.value = false;
  mocks.downloadUpdate.mockReset();
  mocks.restartToUpdate.mockReset();
  mocks.openManualUpdate.mockReset();
  mocks.openDialog.mockReset();
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
});

describe("AppUpdateButton", () => {
  it("starts a hot update download", async () => {
    mocks.state.value = {
      status: "hotAvailable",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: 0,
    };
    const container = mountButton();
    expect(container.textContent).toContain("更新");
    container.querySelector("button")!.click();
    await nextTick();
    expect(mocks.downloadUpdate).toHaveBeenCalledOnce();
  });

  it("renders download progress", () => {
    mocks.state.value = {
      status: "downloading",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: 42,
    };
    const container = mountButton();
    const progressbar = container.querySelector("[role=progressbar]");
    expect(progressbar?.getAttribute("aria-valuemin")).toBe("1");
    expect(progressbar?.getAttribute("aria-valuemax")).toBe("100");
    expect(progressbar?.getAttribute("aria-valuenow")).toBe("42");
    expect(progressbar?.getAttribute("aria-label")).toBe("下载进度 42%");
    expect(container.textContent).toContain("42%");
    expect(container.querySelector<HTMLElement>("[data-update-progress-fill]")?.style.width).toBe(
      "42%",
    );
  });

  it.each([
    { input: 0, expected: 1 },
    { input: -10, expected: 1 },
    { input: 120, expected: 100 },
  ])("clamps download progress $input to $expected", ({ input, expected }) => {
    mocks.state.value = {
      status: "downloading",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: input,
    };
    const container = mountButton();
    const progressbar = container.querySelector("[role=progressbar]");
    expect(progressbar?.getAttribute("aria-valuenow")).toBe(String(expected));
    expect(container.querySelector<HTMLElement>("[data-update-progress-fill]")?.style.width).toBe(
      `${expected}%`,
    );
  });

  it("asks for confirmation before restarting with running sessions", () => {
    mocks.state.value = {
      status: "ready",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: 100,
    };
    mocks.hasRunningSessions.value = true;
    const container = mountButton();
    expect(container.textContent).toContain("重启");
    container.querySelector("button")!.click();
    expect(mocks.openDialog).toHaveBeenCalledOnce();
    expect(mocks.restartToUpdate).not.toHaveBeenCalled();
  });

  it("retries a failed download", async () => {
    mocks.state.value = {
      status: "downloadFailed",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: 0,
    };
    const container = mountButton();
    const button = container.querySelector("button")!;
    expect(button.title).toBe("下载失败，点击重试");
    expect(container.textContent).toContain("更新");
    button.click();
    await nextTick();
    expect(mocks.downloadUpdate).toHaveBeenCalledOnce();
  });
});
