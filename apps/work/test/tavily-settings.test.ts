// @vitest-environment jsdom

import { Dialog } from "@willow/shadcn/components/ui/dialog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App, type Component } from "vue";

const mocks = vi.hoisted(() => ({
  deleteTavilyApiKey: vi.fn(),
  getTavilySettings: vi.fn(),
  setTavilyApiKey: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    deleteTavilyApiKey: mocks.deleteTavilyApiKey,
    getTavilySettings: mocks.getTavilySettings,
    setTavilyApiKey: mocks.setTavilyApiKey,
  },
}));

import { useDialog } from "../src/renderer/src/components/dialog";
import SearchSettings from "../src/renderer/src/components/dialog/setting/SearchSettings.vue";
import TavilyConnectDialog from "../src/renderer/src/components/dialog/setting/TavilyConnectDialog.vue";

const mountedApps: App[] = [];
const SettingHarness = defineComponent({
  props: {
    initialTab: String,
  },
  render: () => null,
});

function mountComponent(component: Component, props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render: () => h(component, props) });
  app.mount(container);
  mountedApps.push(app);
  return container;
}

function mountTavilyDialog(props: Record<string, unknown>) {
  const wrapper = defineComponent({
    render: () => h(Dialog, { open: true }, { default: () => h(TavilyConnectDialog, props) }),
  });
  return mountComponent(wrapper);
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  useDialog().openDialog(SettingHarness, { initialTab: "search" }, { contentClass: "setting" });
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  useDialog().closeDialog();
});

describe("SearchSettings", () => {
  it("shows the available provider row and opens the connect dialog", async () => {
    mocks.getTavilySettings.mockResolvedValueOnce({ configured: false });
    const container = mountComponent(SearchSettings);

    await vi.waitFor(() => expect(container.textContent).toContain("使用 Tavily API Key 连接"));
    findButton(container, "连接").click();
    await nextTick();

    const state = useDialog().dialogState.value;
    expect(state?.component).toBe(TavilyConnectDialog);
    expect(state?.props?.mode).toBe("connect");

    const onBack = state?.props?.onBack;
    expect(onBack).toBeTypeOf("function");
    (onBack as () => void)();
    expect(useDialog().dialogState.value?.component).toBe(SettingHarness);
    expect(useDialog().dialogState.value?.props?.initialTab).toBe("search");
  });

  it("shows connected actions and keeps usage below the provider row", async () => {
    mocks.getTavilySettings.mockResolvedValueOnce({
      configured: true,
      usage: {
        currentPlan: "Bootstrap",
        planUsage: 10,
        planLimit: 1_000,
      },
    });
    const container = mountComponent(SearchSettings);

    await vi.waitFor(() => expect(container.textContent).toContain("API 密钥"));
    expect(container.textContent).toContain("本月用量");
    expect(container.textContent).toContain("1,000 Credits");
    expect(container.querySelector('[aria-label="修改 Tavily API Key"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="删除 Tavily API Key 并断开连接"]')).not.toBeNull();

    container.querySelector<HTMLButtonElement>('[aria-label="修改 Tavily API Key"]')?.click();
    await nextTick();
    expect(useDialog().dialogState.value?.component).toBe(TavilyConnectDialog);
    expect(useDialog().dialogState.value?.props?.mode).toBe("edit");
  });

  it("disconnects immediately and switches back to the available state", async () => {
    mocks.getTavilySettings.mockResolvedValueOnce({
      configured: true,
      usage: {
        currentPlan: "Bootstrap",
        planUsage: 10,
        planLimit: 1_000,
      },
    });
    mocks.deleteTavilyApiKey.mockResolvedValueOnce({});
    const container = mountComponent(SearchSettings);

    await vi.waitFor(() => expect(container.textContent).toContain("本月用量"));
    container
      .querySelector<HTMLButtonElement>('[aria-label="删除 Tavily API Key 并断开连接"]')
      ?.click();

    await vi.waitFor(() => expect(mocks.deleteTavilyApiKey).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(container.textContent).toContain("使用 Tavily API Key 连接"));
    expect(container.textContent).not.toContain("本月用量");
  });

  it("keeps the connected state and reports delete failures inline", async () => {
    mocks.getTavilySettings.mockResolvedValueOnce({ configured: true });
    mocks.deleteTavilyApiKey.mockRejectedValueOnce(new Error("failed"));
    const container = mountComponent(SearchSettings);

    await vi.waitFor(() => expect(container.textContent).toContain("API 密钥"));
    container
      .querySelector<HTMLButtonElement>('[aria-label="删除 Tavily API Key 并断开连接"]')
      ?.click();

    await vi.waitFor(() =>
      expect(container.textContent).toContain("删除 Tavily API Key 失败，请重试。"),
    );
    expect(container.textContent).toContain("API 密钥");
  });

  it("reports initial and usage refresh failures without losing configured state", async () => {
    mocks.getTavilySettings.mockRejectedValueOnce(new Error("load failed")).mockResolvedValueOnce({
      configured: true,
      usageError: "Tavily 用量请求失败（500）",
    });
    const failedContainer = mountComponent(SearchSettings);
    await vi.waitFor(() =>
      expect(failedContainer.textContent).toContain("无法读取 Tavily 设置，请重试。"),
    );

    mountedApps.pop()?.unmount();
    failedContainer.remove();
    const configuredContainer = mountComponent(SearchSettings);
    await vi.waitFor(() =>
      expect(configuredContainer.textContent).toContain("Tavily 用量请求失败（500）"),
    );
    expect(configuredContainer.textContent).toContain("API 密钥");
    expect(configuredContainer.textContent).toContain("暂时无法读取套餐信息");
  });
});

describe("TavilyConnectDialog", () => {
  it("requires a key and emits saved after validating a trimmed value", async () => {
    mocks.setTavilyApiKey.mockResolvedValueOnce({
      configured: true,
      usage: {
        currentPlan: "Bootstrap",
        planUsage: 0,
        planLimit: 1_000,
      },
    });
    const onSaved = vi.fn();
    const container = mountTavilyDialog({
      mode: "connect",
      onSaved,
    });
    const input = container.querySelector<HTMLInputElement>("#tavily-connect-api-key");
    const submit = findButton(container, "提交");

    expect(submit.disabled).toBe(true);
    if (!input) throw new Error("API Key input was not rendered");
    input.value = "  tvly-secret  ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(submit.disabled).toBe(false);
    submit.click();

    await vi.waitFor(() =>
      expect(mocks.setTavilyApiKey).toHaveBeenCalledWith({ apiKey: "tvly-secret" }),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("does not expose an existing key in edit mode and renders validation errors", async () => {
    mocks.setTavilyApiKey.mockRejectedValueOnce(new Error("API Key 无效"));
    const container = mountTavilyDialog({ mode: "edit" });
    const input = container.querySelector<HTMLInputElement>("#tavily-connect-api-key");

    expect(container.textContent).toContain("修改 Tavily");
    expect(input?.value).toBe("");
    if (!input) throw new Error("API Key input was not rendered");
    input.value = "invalid";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    findButton(container, "更新密钥").click();

    await vi.waitFor(() => expect(container.textContent).toContain("API Key 无效"));
  });
});
