// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";
import type { ReviewPanelState } from "../src/renderer/src/components/right-sidebar/types";
import type { GitReviewStatus } from "../src/shared/api";

const mocks = vi.hoisted(() => ({
  getGitReviewDiff: vi.fn(),
  getGitReviewStatus: vi.fn(),
  stageGitChanges: vi.fn(async () => ({})),
  unstageGitChanges: vi.fn(async () => ({})),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: mocks,
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    waitUntilReady: vi.fn(async () => undefined),
  }),
}));

vi.mock("../src/renderer/src/components/right-sidebar/MonacoCodeViewer.vue", () => ({
  default: defineComponent({
    props: { code: String, language: String, variant: String },
    setup(props) {
      return () =>
        h("div", {
          "data-code": props.code,
          "data-language": props.language,
          "data-slot": "monaco-code-viewer",
          "data-variant": props.variant,
        });
    },
  }),
}));

import { useDialog } from "../src/renderer/src/components/dialog";
import ReviewPanel from "../src/renderer/src/components/right-sidebar/ReviewPanel.vue";

const mountedApps: App[] = [];

const review: GitReviewStatus = {
  repository: true,
  branch: "feature/review",
  upstream: "origin/feature/review",
  ahead: 1,
  behind: 2,
  additions: 7,
  deletions: 3,
  staged: [
    {
      additions: 2,
      area: "staged",
      deletions: 1,
      path: "src/staged.ts",
      status: "modified",
    },
  ],
  unstaged: [
    {
      additions: 5,
      area: "unstaged",
      deletions: 2,
      path: "src/nested/unstaged.ts",
      status: "modified",
    },
  ],
};

function mountPanel(initialState: ReviewPanelState = {}) {
  const state = ref(initialState);
  const container = document.createElement("div");
  Object.defineProperty(container, "getBoundingClientRect", {
    value: () => ({ width: 720 }),
  });
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(ReviewPanel, {
        "onUpdate:state": (value: ReviewPanelState) => {
          state.value = value;
        },
        state: state.value,
        tabId: "review-tab",
        workspaceId: 1,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, state };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getGitReviewStatus.mockResolvedValue({ review });
  mocks.getGitReviewDiff.mockResolvedValue({
    diff: { binary: false, content: "@@ -1 +1 @@\n-old\n+new", truncated: false },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      disconnect() {}
      observe() {
        this.callback(
          [{ contentRect: { width: 720 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
    },
  );
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  useDialog().closeDialog();
  vi.unstubAllGlobals();
});

describe("ReviewPanel", () => {
  it("loads real changes into grouped trees and previews the selected diff with Monaco", async () => {
    const { container, state } = mountPanel();
    await vi.waitFor(() =>
      expect(mocks.getGitReviewStatus).toHaveBeenCalledWith({ workspaceId: 1 }),
    );
    await vi.waitFor(() => expect(mocks.getGitReviewDiff).toHaveBeenCalled());

    expect(state.value.selectedChange).toEqual({ area: "staged", path: "src/staged.ts" });
    expect(container.textContent).toContain("feature/review");
    expect(container.textContent).toContain("暂存的更改");
    expect(container.textContent).toContain("更改");
    expect(container.querySelector('[data-node-id="file:staged:src/staged.ts"]')).not.toBeNull();
    expect(
      container.querySelector('[data-node-id="file:unstaged:src/nested/unstaged.ts"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-node-kind="directory"]')).toBeNull();
    expect(container.textContent).toContain("src/nested");
    const viewer = container.querySelector('[data-slot="monaco-code-viewer"]');
    expect(viewer?.getAttribute("data-variant")).toBe("diff");
    expect(viewer?.getAttribute("data-code")).toContain("+new");
  });

  it("filters paths, stages a single file, and opens the commit dialog", async () => {
    const { container } = mountPanel({
      selectedChange: { area: "unstaged", path: "src/nested/unstaged.ts" },
    });
    await vi.waitFor(() =>
      expect(container.querySelector('[data-slot="review-tree"]')).not.toBeNull(),
    );

    const input = container.querySelector<HTMLInputElement>('input[placeholder="筛选变更…"]')!;
    input.value = "src/staged";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(container.querySelector('[data-node-id="file:staged:src/staged.ts"]')).not.toBeNull();
    expect(
      container.querySelector('[data-node-id="file:unstaged:src/nested/unstaged.ts"]'),
    ).toBeNull();

    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    const stageButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="暂存 src/nested/unstaged.ts"]',
    )!;
    stageButton.click();
    await vi.waitFor(() =>
      expect(mocks.stageGitChanges).toHaveBeenCalledWith({
        workspaceId: 1,
        paths: ["src/nested/unstaged.ts"],
      }),
    );

    const commitButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "提交",
    );
    await vi.waitFor(() => expect(commitButton?.disabled).toBe(false));
    commitButton?.click();
    expect(useDialog().dialogState.value?.component).toBeTruthy();
    expect(useDialog().dialogState.value?.props).toEqual(
      expect.objectContaining({ workspaceId: 1, stagedCount: 1, additions: 2, deletions: 1 }),
    );
  });

  it("resizes the diff and file-list panes after the async review layout is mounted", async () => {
    const { container } = mountPanel();
    const layout = await vi.waitFor(() => {
      const element = container.querySelector<HTMLElement>(
        '[data-slot="review-panel-split-layout"]',
      );
      expect(element?.style.gridTemplateColumns).toBe("475px 8px 237px");
      return element!;
    });
    const handle = container.querySelector<HTMLElement>(
      '[data-slot="review-panel-resize-handle"]',
    )!;

    handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 500 }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 400 }));
    await nextTick();

    expect(layout.style.gridTemplateColumns).toBe("375px 8px 337px");
    window.dispatchEvent(new MouseEvent("pointerup"));
    expect(localStorage.getItem("willow:review-panel-browser-width")).toBe("337");
  });
});
