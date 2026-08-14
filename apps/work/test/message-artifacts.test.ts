// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";

vi.mock("../src/renderer/src/components/message-list/blocks/MarkdownBlock.vue", () => ({
  default: defineComponent({
    props: { content: { type: String, required: true } },
    setup(props) {
      return () => h("div", { "data-content": props.content, "data-slot": "markdown-block" });
    },
  }),
}));

import { MessageList, type Message } from "../src/renderer/src/components/message-list";
import { onPlanPreviewRequested } from "../src/renderer/src/lib/app-state-events";

const mountedApps: App[] = [];

function mount(messages: Message[]): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(MessageList, {
        messages,
        sessionId: "session",
        workspaceId: 1,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return container;
}

function assistantMessage(artifact?: Message["artifact"]): Message {
  return {
    artifact,
    content: [{ type: "text", text: "任务完成" }],
    id: "assistant:1",
    role: "assistant",
    sourceKey: "assistant:1:",
    status: "completed",
    timestamp: 12,
  };
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("message artifacts", () => {
  it("renders artifacts above the toolbar and expands files after the first three", async () => {
    const container = mount([
      assistantMessage({
        assistantTimestamp: 12,
        files: Array.from({ length: 5 }, (_, index) => ({
          additions: index + 1,
          deletions: index,
          path: `src/file-${index + 1}.ts`,
          status: index === 0 ? ("added" as const) : ("modified" as const),
        })),
        plans: [],
        version: 1,
      }),
    ]);

    const artifactArea = container.querySelector("[data-slot=artifact-area]");
    const toolbar = container.querySelector("[data-slot=message-toolbar]");
    expect(artifactArea).not.toBeNull();
    expect(
      artifactArea?.compareDocumentPosition(toolbar as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelectorAll("[data-slot=file-artifact-item]")).toHaveLength(3);
    expect(container.textContent).toContain("已更改 5 个文件");
    expect(container.textContent).toContain("+15");
    expect(container.textContent).toContain("-10");

    container.querySelector<HTMLButtonElement>("[aria-label='再显示 2 个文件']")?.click();
    await nextTick();
    expect(container.querySelectorAll("[data-slot=file-artifact-item]")).toHaveLength(5);
  });

  it("clips the Plan preview by height and requests a full sidebar preview", async () => {
    const content = Array.from({ length: 25 }, (_, index) => `Line ${index + 1}`).join("\n");
    const plan = {
      byteCount: content.length,
      content,
      fileName: "feature-plan.md",
      lineCount: 25,
      path: "/plans/feature-plan.md",
    };
    const container = mount([
      assistantMessage({
        assistantTimestamp: 12,
        files: [],
        plans: [plan],
        version: 1,
      }),
    ]);

    const preview = container
      .querySelector("[data-slot=plan-artifact-card] [data-slot=markdown-block]")
      ?.getAttribute("data-content");
    expect(preview).toBe(content);
    expect(container.querySelector("[data-slot=plan-artifact-preview]")?.className).toContain(
      "max-h-80",
    );
    expect(container.querySelector("[data-slot=plan-artifact-preview]")?.className).toContain(
      "overflow-hidden",
    );
    expect(container.querySelector("[data-slot=plan-artifact-gradient]")).not.toBeNull();
    expect(container.querySelector("[aria-label='复制 Plan']")).toBeNull();
    expect(container.querySelector("[aria-label='使用系统应用打开 Plan']")).toBeNull();

    const listener = vi.fn();
    const removeListener = onPlanPreviewRequested(listener);
    container.querySelector<HTMLButtonElement>("[aria-label='在右侧边栏查看完整 Plan']")?.click();
    await nextTick();
    expect(listener).toHaveBeenCalledWith(plan);
    removeListener();
  });

  it("keeps messages without artifacts unchanged", () => {
    const container = mount([assistantMessage()]);
    expect(container.querySelector("[data-slot=artifact-area]")).toBeNull();
    expect(container.querySelector("[data-slot=message-toolbar]")).not.toBeNull();
  });
});
