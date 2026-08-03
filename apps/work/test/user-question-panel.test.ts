// @vitest-environment jsdom

import type { UserQuestionEventPayload } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import UserQuestionPanel from "../src/renderer/src/components/tool/UserQuestionPanel.vue";

const mountedApps: App[] = [];

const request: UserQuestionEventPayload = {
  requestId: "question",
  workspaceId: 1,
  sessionId: "session",
  toolCallId: "call",
  questions: [
    {
      header: "实现",
      question: "选择实现方式？",
      options: [
        { label: "方案 A", description: "改动较小" },
        { label: "方案 B", description: "扩展性更好" },
      ],
    },
    {
      header: "验证",
      question: "需要哪些验证？",
      options: [
        { label: "单元测试", description: "运行 Vitest" },
        { label: "手动验证", description: "运行 Electron" },
      ],
      multiSelect: true,
    },
  ],
};

function mountPanel(onSubmit = vi.fn(async () => undefined)) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render: () => h(UserQuestionPanel, { request, onSubmit }) });
  app.mount(container);
  mountedApps.push(app);
  return { container, onSubmit };
}

function getControl(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ?? undefined;
}

async function flushSubmit(): Promise<void> {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("UserQuestionPanel", () => {
  it("collects one answer for every question before submitting", async () => {
    const mounted = mountPanel();
    const getButton = (text: string) =>
      [...mounted.container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes(text),
      );

    expect(mounted.container.querySelector("[data-slot=user-question-panel]")).not.toBeNull();
    expect(mounted.container.textContent).toContain("1/2");
    expect(mounted.container.textContent).toContain("选择实现方式？");
    expect(mounted.container.textContent).not.toContain("需要哪些验证？");
    expect(mounted.container.querySelector("[data-slot=radio-group]")).not.toBeNull();
    expect(getButton("下一道")?.disabled).toBe(true);

    getControl(mounted.container, "方案 A")?.click();
    await nextTick();
    expect(getButton("下一道")?.disabled).toBe(false);
    getButton("下一道")?.click();
    await nextTick();

    expect(mounted.container.textContent).toContain("2/2");
    expect(mounted.container.textContent).not.toContain("选择实现方式？");
    expect(mounted.container.textContent).toContain("需要哪些验证？");
    expect(mounted.container.querySelector("[data-slot=checkbox]")).not.toBeNull();
    expect(getButton("确认回答")?.disabled).toBe(true);
    getControl(mounted.container, "单元测试")?.click();
    getControl(mounted.container, "手动验证")?.click();
    await nextTick();

    expect(getButton("确认回答")?.disabled).toBe(false);
    getButton("确认回答")?.click();
    await flushSubmit();
    expect(mounted.onSubmit).toHaveBeenCalledWith({
      "选择实现方式？": ["方案 A"],
      "需要哪些验证？": ["单元测试", "手动验证"],
    });
  });

  it("shows a direct custom answer input and supports explicit dismissal", async () => {
    const mounted = mountPanel();
    const customInput = mounted.container.querySelector<HTMLInputElement>(
      'input[aria-label="其他回答"]',
    );
    expect(customInput).not.toBeNull();
    expect(customInput?.placeholder).toBe("输入其他");

    const skip = [...mounted.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("跳过"),
    );
    skip?.click();
    await flushSubmit();
    expect(mounted.onSubmit).toHaveBeenCalledWith(undefined);
  });

  it("uses custom input as an answer without an extra selection step", async () => {
    const mounted = mountPanel();
    const getButton = (text: string) =>
      [...mounted.container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes(text),
      );
    const customInput = mounted.container.querySelector<HTMLInputElement>(
      'input[aria-label="其他回答"]',
    );

    if (customInput) {
      customInput.value = "自定义方案";
      customInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await nextTick();
    expect(getButton("下一道")?.disabled).toBe(false);
    getButton("下一道")?.click();
    await nextTick();
    getControl(mounted.container, "单元测试")?.click();
    await nextTick();
    getButton("确认回答")?.click();
    await flushSubmit();

    expect(mounted.onSubmit).toHaveBeenCalledWith({
      "选择实现方式？": ["自定义方案"],
      "需要哪些验证？": ["单元测试"],
    });
  });

  it("switches between questions from the header and preserves answers", async () => {
    const mounted = mountPanel();
    const next = mounted.container.querySelector<HTMLButtonElement>(
      'button[aria-label="下一道题目"]',
    );
    const previous = mounted.container.querySelector<HTMLButtonElement>(
      'button[aria-label="上一道题目"]',
    );

    expect(previous?.disabled).toBe(true);
    next?.click();
    await nextTick();
    expect(next?.disabled).toBe(true);
    expect(mounted.container.textContent).toContain("需要哪些验证？");

    previous?.click();
    await nextTick();
    const option = getControl(mounted.container, "方案 B");
    option?.click();
    next?.click();
    await nextTick();
    previous?.click();
    await nextTick();

    const restoredOption = getControl(mounted.container, "方案 B");
    expect(restoredOption?.getAttribute("data-state")).toBe("checked");
  });
});
