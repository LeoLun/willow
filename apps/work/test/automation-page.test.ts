// @vitest-environment jsdom

import type { AutomationListItem } from "@shared/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick, type App } from "vue";

const mocks = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  updateAutomation: vi.fn(),
  getAutomation: vi.fn(),
  listAutomationRuns: vi.fn(),
  getWorkspaceList: vi.fn(),
  getProviderCatalog: vi.fn(),
  getConfiguredProviders: vi.fn(),
  push: vi.fn(),
  registerEvent: vi.fn((_request: unknown, callback: (event: string, data: unknown) => void) => {
    globalThis.__eventCallback = callback;
    return Promise.resolve({});
  }),
}));

let routeParams: Record<string, string> = {};

declare global {
  // eslint-disable-next-line no-var
  var __eventCallback: ((event: string, data: unknown) => void) | undefined;
}

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    listAutomations: mocks.listAutomations,
    updateAutomation: mocks.updateAutomation,
    getAutomation: mocks.getAutomation,
    listAutomationRuns: mocks.listAutomationRuns,
    getWorkspaceList: mocks.getWorkspaceList,
    getProviderCatalog: mocks.getProviderCatalog,
    getConfiguredProviders: mocks.getConfiguredProviders,
    registerEvent: mocks.registerEvent,
  },
}));

vi.mock("vue-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("vue-router")>();
  return {
    ...original,
    useRouter: () => ({ push: mocks.push }),
    useRoute: () => ({ params: routeParams }),
  };
});

import { consumeGuidedPrompt } from "../src/renderer/src/lib/app-state-events";
import { GUIDED_AUTOMATION_TEMPLATE } from "../src/renderer/src/lib/automation-guide";
import Auto from "../src/renderer/src/pages/main/auto/Auto.vue";

const mountedApps: App[] = [];

function automationItem(overrides: Partial<AutomationListItem> = {}): AutomationListItem {
  return {
    id: 1,
    workspaceId: 7,
    workspaceName: "Willow",
    title: "每日审查",
    status: "enabled",
    cronExpression: "0 9 * * *",
    timezone: "Asia/Shanghai",
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    updatedAt: new Date("2026-08-08T00:00:00.000Z"),
    ...overrides,
  };
}

async function mountPage(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp(Auto);
  app.mount(container);
  mountedApps.push(app);
  await nextTick();
  return container;
}

beforeEach(() => {
  vi.clearAllMocks();
  routeParams = {};
  mocks.push.mockResolvedValue(undefined);
  mocks.getWorkspaceList.mockResolvedValue({ workspaces: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  consumeGuidedPrompt();
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  globalThis.__eventCallback = undefined;
});

describe("automation list page", () => {
  it("shows a loading state while fetching", async () => {
    let resolve!: (value: { automations: AutomationListItem[] }) => void;
    mocks.listAutomations.mockReturnValue(new Promise((r) => (resolve = r)));

    const container = await mountPage();
    expect(container.querySelector("[data-slot=automation-loading]")).toBeTruthy();
    resolve({ automations: [] });
    await nextTick();
  });

  it("shows an error state and retries", async () => {
    mocks.listAutomations.mockRejectedValueOnce(new Error("boom"));
    const container = await mountPage();

    expect(container.querySelector("[data-slot=automation-error]")).toBeTruthy();
    expect(container.textContent).toContain("boom");

    mocks.listAutomations.mockResolvedValue({ automations: [automationItem()] });
    container.querySelector<HTMLButtonElement>("[data-slot=automation-retry]")?.click();
    await nextTick();
    await nextTick();
    expect(container.querySelector("[data-slot=automation-list]")).toBeTruthy();
  });

  it("shows an empty state when there are no automations", async () => {
    mocks.listAutomations.mockResolvedValue({ automations: [] });
    const container = await mountPage();
    expect(container.querySelector("[data-slot=automation-empty]")).toBeTruthy();
  });

  it("renders automation rows with schedule and status summaries", async () => {
    mocks.listAutomations.mockResolvedValue({
      automations: [
        automationItem({
          id: 1,
          title: "每日审查",
          cronExpression: "30 9 * * *",
          timezone: "UTC",
          nextRunAt: new Date("2026-08-09T09:30:00.000Z"),
          lastRun: {
            status: "failed",
            runKind: "scheduled",
            triggeredAt: new Date("2026-08-08T09:30:00.000Z"),
            finishedAt: new Date("2026-08-08T09:31:00.000Z"),
          },
        }),
        automationItem({
          id: 2,
          title: "停用的任务",
          status: "disabled",
          cronExpression: "0 * * * *",
        }),
      ],
    });

    const container = await mountPage();
    const rows = container.querySelectorAll("[data-slot^=automation-item]");
    expect(rows.length).toBe(2);
    expect(container.textContent).toContain("每日审查");
    expect(container.textContent).toContain("Willow");
    expect(container.textContent).toContain("每天 09:30");
    expect(container.textContent).toContain("失败");
    expect(container.textContent).toContain("每小时");

    const switches = container.querySelectorAll("[data-slot=automation-status-switch]");
    expect(switches.length).toBe(2);
  });

  it("navigates to home and requests a guided prompt when creating", async () => {
    mocks.listAutomations.mockResolvedValue({ automations: [automationItem()] });
    const container = await mountPage();

    container.querySelector<HTMLButtonElement>("[data-slot=create-automation-button]")?.click();
    await nextTick();

    expect(mocks.push).toHaveBeenCalledWith({ name: "home" });
    expect(consumeGuidedPrompt()).toBe(GUIDED_AUTOMATION_TEMPLATE);
  });

  it("requests a guided prompt from the empty state", async () => {
    mocks.listAutomations.mockResolvedValue({ automations: [] });
    const container = await mountPage();

    container.querySelector<HTMLButtonElement>("[data-slot=automation-empty] button")?.click();
    await nextTick();

    expect(mocks.push).toHaveBeenCalledWith({ name: "home" });
    expect(consumeGuidedPrompt()).toBe(GUIDED_AUTOMATION_TEMPLATE);
  });

  it("navigates to the automation route with the selected id when a row is clicked", async () => {
    mocks.listAutomations.mockResolvedValue({ automations: [automationItem()] });
    const container = await mountPage();

    container.querySelector<HTMLElement>("[data-slot=automation-item-1]")?.click();
    expect(mocks.push).toHaveBeenCalledWith({
      name: "auto",
      params: { automationId: "1" },
    });
  });

  it("opens the automation detail panel in the right sidebar when selected", async () => {
    routeParams = { automationId: "1" };
    mocks.listAutomations.mockResolvedValue({ automations: [automationItem()] });
    mocks.getAutomation.mockResolvedValue({
      automation: {
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
      },
    });
    mocks.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: undefined });
    const container = await mountPage();

    expect(container.querySelector("[data-slot=automation-detail-panel]")).toBeTruthy();
    expect(container.textContent).toContain("每日审查");
    expect(container.querySelector("[data-slot=automation-detail-tabs]")).toBeTruthy();

    container.querySelector<HTMLButtonElement>("[data-slot=automation-detail-close]")?.click();
    await nextTick();
    expect(mocks.push).toHaveBeenCalledWith({ name: "auto" });
  });

  it("toggles the enabled status through the API", async () => {
    mocks.listAutomations.mockResolvedValue({ automations: [automationItem()] });
    mocks.updateAutomation.mockResolvedValue({ automation: {} });
    const container = await mountPage();

    const switchInput = container.querySelector<HTMLElement>(
      "[data-slot=automation-status-switch]",
    );
    switchInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await nextTick();

    expect(mocks.updateAutomation).toHaveBeenCalledWith({ id: 1, status: "disabled" });
  });
});
