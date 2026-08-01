// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";

const mocks = vi.hoisted(() => ({
  getAppInfo: vi.fn(),
  getAutoLaunch: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getProviderCatalog: vi.fn(),
  getUserConfig: vi.fn(),
  setAutoLaunch: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getAppInfo: mocks.getAppInfo,
    getAutoLaunch: mocks.getAutoLaunch,
    getConfiguredProviders: mocks.getConfiguredProviders,
    getProviderCatalog: mocks.getProviderCatalog,
    getUserConfig: mocks.getUserConfig,
    setAutoLaunch: mocks.setAutoLaunch,
  },
}));

vi.mock("@/composables/useDarkMode", async () => {
  const { ref } = await import("vue");
  return {
    useDarkMode: () => ({ isDark: ref(false), themeMode: ref("system") }),
  };
});

vi.mock("@willow/shadcn/components/ui/dialog", async () => {
  const { defineComponent, h } = await import("vue");
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_props, { slots }) {
        return () => h("div", slots.default?.());
      },
    });
  return {
    DialogDescription: passthrough("DialogDescription"),
    DialogTitle: passthrough("DialogTitle"),
  };
});

import Setting from "../src/renderer/src/components/dialog/setting/Setting.vue";

const mountedApps: App[] = [];

async function mountSetting(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const vueApp = createApp({ render: () => h(Setting) });
  vueApp.mount(container);
  mountedApps.push(vueApp);
  await nextTick();
  await vi.waitFor(() => expect(mocks.getAutoLaunch).toHaveBeenCalledOnce());
  await nextTick();
  return container;
}

function autoLaunchSwitch(container: HTMLElement): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>("[data-slot=auto-launch-switch]");
  if (!element) throw new Error("auto-launch switch was not rendered");
  return element;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAppInfo.mockResolvedValue({ name: "Willow", version: "1.0.4" });
  mocks.getAutoLaunch.mockResolvedValue({
    enabled: false,
    requiresApproval: false,
    supported: true,
  });
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getUserConfig.mockResolvedValue({});
  mocks.setAutoLaunch.mockResolvedValue({
    enabled: true,
    requiresApproval: false,
    supported: true,
  });
});

afterEach(() => {
  for (const vueApp of mountedApps.splice(0)) vueApp.unmount();
  document.body.replaceChildren();
});

describe("general auto-launch setting", () => {
  it("loads the system state and enables auto-launch", async () => {
    const container = await mountSetting();
    const toggle = autoLaunchSwitch(container);

    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute("data-state")).toBe("unchecked");
    toggle.click();

    await vi.waitFor(() => expect(mocks.setAutoLaunch).toHaveBeenCalledWith({ enabled: true }));
    await vi.waitFor(() => expect(toggle.getAttribute("data-state")).toBe("checked"));
  });

  it("keeps the previous state and shows an error when saving fails", async () => {
    mocks.setAutoLaunch.mockRejectedValueOnce(new Error("system failure"));
    const container = await mountSetting();
    const toggle = autoLaunchSwitch(container);

    toggle.click();

    await vi.waitFor(() =>
      expect(container.textContent).toContain("保存开机启动设置失败，请重试。"),
    );
    expect(toggle.getAttribute("data-state")).toBe("unchecked");
  });

  it("shows the macOS approval message and reflects the effective state", async () => {
    mocks.setAutoLaunch.mockResolvedValueOnce({
      enabled: false,
      requiresApproval: true,
      supported: true,
    });
    const container = await mountSetting();
    const toggle = autoLaunchSwitch(container);

    toggle.click();

    await vi.waitFor(() =>
      expect(container.textContent).toContain("请前往系统设置允许 Willow 在登录时启动。"),
    );
    expect(toggle.getAttribute("data-state")).toBe("unchecked");
  });

  it("disables the setting outside an installed build", async () => {
    mocks.getAutoLaunch.mockResolvedValueOnce({
      enabled: false,
      requiresApproval: false,
      supported: false,
    });

    const container = await mountSetting();

    expect(autoLaunchSwitch(container).disabled).toBe(true);
    expect(container.textContent).toContain("开机自动启动仅在安装版 Willow 中可用。");
  });
});
