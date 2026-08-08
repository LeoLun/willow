// @vitest-environment jsdom

import type { AutomationInfo, AutomationRunInfo } from "@shared/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick, type App } from "vue";

const mocks = vi.hoisted(() => ({
  getAutomation: vi.fn(),
  listAutomationRuns: vi.fn(),
  getWorkspaceList: vi.fn(),
  getProviderCatalog: vi.fn(),
  getConfiguredProviders: vi.fn(),
  updateAutomation: vi.fn(),
  runAutomationNow: vi.fn(),
  deleteAutomation: vi.fn(),
  push: vi.fn(),
  registerEvent: vi.fn((_request: unknown, callback: (event: string, data: unknown) => void) => {
    globalThis.__eventCallback = callback;
    return Promise.resolve({});
  }),
}));

declare global {
  // eslint-disable-next-line no-var
  var __eventCallback: ((event: string, data: unknown) => void) | undefined;
}

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getAutomation: mocks.getAutomation,
    listAutomationRuns: mocks.listAutomationRuns,
    getWorkspaceList: mocks.getWorkspaceList,
    getProviderCatalog: mocks.getProviderCatalog,
    getConfiguredProviders: mocks.getConfiguredProviders,
    updateAutomation: mocks.updateAutomation,
    runAutomationNow: mocks.runAutomationNow,
    deleteAutomation: mocks.deleteAutomation,
    registerEvent: mocks.registerEvent,
  },
}));

vi.mock("vue-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("vue-router")>();
  return {
    ...original,
    useRouter: () => ({ push: mocks.push }),
  };
});

import AutomationDetailPanel from "../src/renderer/src/components/automation/AutomationDetailPanel.vue";

const mountedApps: App[] = [];

function automationInfo(overrides: Partial<AutomationInfo> = {}): AutomationInfo {
  return {
    id: 1,
    workspaceId: 7,
    title: "每日审查",
    prompt: "请审查今天的代码变更",
    status: "enabled",
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    updatedAt: new Date("2026-08-08T00:00:00.000Z"),
    trigger: {
      id: 1,
      automationId: 1,
      type: "schedule",
      cronExpression: "30 9 * * *",
      timezone: "UTC",
      isActive: true,
      createdAt: new Date("2026-08-08T00:00:00.000Z"),
      updatedAt: new Date("2026-08-08T00:00:00.000Z"),
    },
    ...overrides,
  };
}

function run(overrides: Partial<AutomationRunInfo> = {}): AutomationRunInfo {
  return {
    id: 10,
    automationId: 1,
    workspaceId: 7,
    sessionId: "agent-1",
    runKind: "scheduled",
    status: "completed",
    scheduledFor: new Date("2026-08-08T09:30:00.000Z"),
    triggeredAt: new Date("2026-08-08T09:30:00.000Z"),
    finishedAt: new Date("2026-08-08T09:31:00.000Z"),
    createdAt: new Date("2026-08-08T09:30:00.000Z"),
    updatedAt: new Date("2026-08-08T09:31:00.000Z"),
    ...overrides,
  };
}

async function mountPage(props: Record<string, unknown> = {}): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp(AutomationDetailPanel, { automationId: 1, ...props });
  app.mount(container);
  mountedApps.push(app);
  await nextTick();
  return container;
}

async function openHistoryTab(container: HTMLElement): Promise<void> {
  // reka-ui tabs activate on mousedown (left button), not click.
  container
    .querySelector<HTMLElement>("[data-slot=automation-history-tab]")
    ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  await nextTick();
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceList.mockResolvedValue({
    workspaces: [
      {
        id: 7,
        name: "Willow",
        path: "/workspace/willow",
        pinned: false,
        createdAt: new Date("2026-08-08T00:00:00.000Z"),
        updatedAt: new Date("2026-08-08T00:00:00.000Z"),
      },
    ],
  });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  mocks.push.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  // Keep the registerEvent callback: useEventBus caches registration at module level,
  // so later tests in this file reuse the same callback.
});

describe("automation detail panel", () => {
  it("renders the automation and its run history across the detail and history tabs", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({
      runs: [
        run(),
        run({
          id: 9,
          status: "failed",
          runKind: "catch_up",
          errorMessage: "AI 审批超时，请由用户确认。",
        }),
        run({ id: 8, status: "skipped", runKind: "scheduled", sessionId: undefined }),
      ],
      nextCursor: undefined,
    });

    const container = await mountPage();

    expect(container.querySelector("[data-slot=automation-detail-panel]")).toBeTruthy();
    expect(container.textContent).toContain("每日审查");
    expect(container.textContent).toContain("已启用");
    expect(container.querySelector("[data-slot=automation-settings]")).toBeTruthy();
    expect(container.textContent).toContain("详情");
    expect(container.textContent).toContain("历史");

    await openHistoryTab(container);
    const runItems = container.querySelectorAll(
      "[data-slot^=automation-run-]:not([data-slot=automation-run-open-session])",
    );
    expect(runItems.length).toBe(3);
    expect(container.textContent).toContain("已完成");
    expect(container.textContent).toContain("失败");
    expect(container.textContent).toContain("AI 审批超时，请由用户确认。");
    expect(container.textContent).toContain("已跳过");
    expect(container.textContent).toContain("查看会话");
  });

  it("emits close when the close button is clicked", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });
    const closed = vi.fn();

    const container = await mountPage({ onClose: closed });
    container.querySelector<HTMLButtonElement>("[data-slot=automation-detail-close]")?.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("shows the not-found state when the automation is missing", async () => {
    mocks.getAutomation.mockRejectedValue(new Error("Automation not found: 1"));
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });

    const container = await mountPage();
    expect(container.querySelector("[data-slot=automation-detail-error]")).toBeTruthy();
  });

  it("disables immediate run when there are unsaved changes", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [run()], nextCursor: undefined });

    const container = await mountPage();
    let runButton = container.querySelector<HTMLButtonElement>("#run-now-button");
    expect(runButton?.disabled).toBe(false);

    const titleInput = container.querySelector<HTMLInputElement>("#detail-title");
    titleInput!.value = "修改后的标题";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    runButton = container.querySelector<HTMLButtonElement>("#run-now-button");
    expect(runButton?.disabled).toBe(true);
  });

  it("disables save and reset until the form has unsaved changes", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });

    const container = await mountPage();
    const saveButton = container.querySelector<HTMLButtonElement>(
      "button[data-slot=automation-save]",
    );
    const resetButton = container.querySelector<HTMLButtonElement>("[data-slot=automation-reset]");
    expect(saveButton?.disabled).toBe(true);
    expect(resetButton?.disabled).toBe(true);

    const titleInput = container.querySelector<HTMLInputElement>("#detail-title");
    titleInput!.value = "修改后的标题";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    expect(saveButton?.disabled).toBe(false);
    expect(resetButton?.disabled).toBe(false);
  });

  it("only lists configured providers when not following the default model", async () => {
    mocks.getAutomation.mockResolvedValue({
      automation: automationInfo({
        model: { providerId: "openai", modelId: "gpt-4o" },
      }),
    });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });
    mocks.getProviderCatalog.mockResolvedValue({
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          apiKeyLabel: "OpenAI API key",
          models: [{ id: "gpt-4o", name: "GPT-4o", thinkingLevels: [] }],
        },
        {
          id: "anthropic",
          name: "Anthropic",
          apiKeyLabel: "Anthropic API key",
          models: [{ id: "claude-sonnet", name: "Claude Sonnet", thinkingLevels: [] }],
        },
      ],
    });
    mocks.getConfiguredProviders.mockResolvedValue({ providerIds: ["anthropic"] });

    const container = await mountPage();

    // The saved provider is no longer configured, so the model selection is cleared.
    const providerTrigger = container.querySelector<HTMLButtonElement>("#detail-model-provider");
    expect(providerTrigger?.textContent?.trim()).toBe("选择提供商");

    // reka-ui selects open on keydown with an open key (pointer events need jsdom
    // pointer-capture support, which is unavailable here).
    providerTrigger?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await nextTick();
    await nextTick();

    const options = [...document.body.querySelectorAll<HTMLElement>("[data-slot=select-item]")];
    const optionTexts = options.map((el) => el.textContent?.trim());
    expect(optionTexts).toContain("Anthropic");
    expect(optionTexts).not.toContain("OpenAI");
  });

  it("treats a freshly created weekday-range automation as clean so it can run now", async () => {
    mocks.getAutomation.mockResolvedValue({
      automation: automationInfo({
        title: "工作日代码审查",
        prompt: "请审查今天的代码变更",
        trigger: {
          ...automationInfo().trigger,
          cronExpression: "0 9 * * 1-5",
        },
      }),
    });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });

    const container = await mountPage();
    const saveButton = container.querySelector<HTMLButtonElement>(
      "button[data-slot=automation-save]",
    );
    const resetButton = container.querySelector<HTMLButtonElement>("[data-slot=automation-reset]");
    const runButton = container.querySelector<HTMLButtonElement>("#run-now-button");

    expect(saveButton?.disabled).toBe(true);
    expect(resetButton?.disabled).toBe(true);
    expect(runButton?.disabled).toBe(false);
  });

  it("saves edits through the API and resets the dirty state", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });
    mocks.updateAutomation.mockResolvedValue({
      automation: automationInfo({ title: "修改后的标题", prompt: "新的提示词" }),
    });

    const container = await mountPage();
    const titleInput = container.querySelector<HTMLInputElement>("#detail-title");
    titleInput!.value = "修改后的标题";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    const promptInput = container.querySelector<HTMLTextAreaElement>("#detail-prompt");
    promptInput!.value = "新的提示词";
    promptInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    container.querySelector<HTMLButtonElement>("button[data-slot=automation-save]")?.click();

    await vi.waitFor(() => {
      expect(mocks.updateAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, title: "修改后的标题", prompt: "新的提示词" }),
      );
    });
    await vi.waitFor(() => {
      const runButton = container.querySelector<HTMLButtonElement>("#run-now-button");
      expect(runButton?.disabled).toBe(false);
    });
  });

  it("runs immediately and navigates to the created session", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });
    mocks.runAutomationNow.mockResolvedValue({
      ...run({ id: 11, runKind: "manual", status: "running" }),
      sessionId: "agent-99",
    });

    const container = await mountPage();
    container.querySelector<HTMLButtonElement>("#run-now-button")?.click();

    await vi.waitFor(() => {
      expect(mocks.runAutomationNow).toHaveBeenCalledWith({ id: 1 });
      expect(mocks.push).toHaveBeenCalledWith({
        name: "chat",
        params: { sessionId: "agent-99" },
        query: { workspaceId: "7" },
      });
    });
  });

  it("shows the failure reason when the run cannot start", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });
    mocks.runAutomationNow.mockResolvedValue({
      ...run({ id: 12, runKind: "manual", status: "failed", sessionId: undefined }),
      errorMessage: "未配置默认大模型，无法执行自动化。",
    });

    const container = await mountPage();
    container.querySelector<HTMLButtonElement>("#run-now-button")?.click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("未配置默认大模型，无法执行自动化。");
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("opens the chat route from a run's view-session button", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [run()], nextCursor: undefined });

    const container = await mountPage();
    await openHistoryTab(container);
    container.querySelector<HTMLButtonElement>("[data-slot=automation-run-open-session]")?.click();

    expect(mocks.push).toHaveBeenCalledWith({
      name: "chat",
      params: { sessionId: "agent-1" },
      query: { workspaceId: "7" },
    });
  });

  it("loads more history with the cursor", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({
      runs: [run()],
      nextCursor: 9,
    });

    const container = await mountPage();
    await openHistoryTab(container);
    mocks.listAutomationRuns.mockResolvedValue({
      runs: [run({ id: 8, triggeredAt: new Date("2026-08-08T08:30:00.000Z") })],
      nextCursor: undefined,
    });
    container.querySelector<HTMLButtonElement>("button[data-slot=automation-load-more]")?.click();

    await vi.waitFor(() => {
      expect(mocks.listAutomationRuns).toHaveBeenLastCalledWith({
        automationId: 1,
        cursor: 9,
      });
    });
    await vi.waitFor(() => {
      expect(
        container.querySelectorAll(
          "[data-slot^=automation-run-]:not([data-slot=automation-run-open-session])",
        ).length,
      ).toBe(2);
    });
  });

  it("keeps unsaved edits and shows a hint on background updates", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });

    const container = await mountPage();
    const titleInput = container.querySelector<HTMLInputElement>("#detail-title");
    titleInput!.value = "未保存的标题";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    mocks.getAutomation.mockResolvedValue({
      automation: automationInfo({ title: "后台更新的标题" }),
    });
    globalThis.__eventCallback?.("AUTOMATION_CHANGED_EVENT", {
      automationId: 1,
      type: "updated",
    });

    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=automation-background-updated]")).toBeTruthy();
    });
    expect(titleInput!.value).toBe("未保存的标题");
  });

  it("reloads the form from the latest automation when there are no unsaved edits", async () => {
    mocks.getAutomation.mockResolvedValue({ automation: automationInfo() });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });

    const container = await mountPage();
    mocks.getAutomation.mockResolvedValue({
      automation: automationInfo({ title: "后台更新的标题" }),
    });
    globalThis.__eventCallback?.("AUTOMATION_CHANGED_EVENT", {
      automationId: 1,
      type: "updated",
    });

    await vi.waitFor(() => {
      const titleInput = container.querySelector<HTMLInputElement>("#detail-title");
      expect(titleInput!.value).toBe("后台更新的标题");
    });
    expect(container.querySelector("[data-slot=automation-background-updated]")).toBeNull();
  });
});
