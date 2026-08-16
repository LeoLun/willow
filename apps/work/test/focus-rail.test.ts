// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, reactive } from "vue";
import FocusRail from "../src/renderer/src/components/focus-rail/FocusRail.vue";
import type { FocusRailItem } from "../src/renderer/src/components/focus-rail/types";

const mountedApps: ReturnType<typeof createApp>[] = [];

const baseItems: FocusRailItem[] = [
  { id: "a", title: "创建 Tray", summary: "初始化 Tray", level: 1 },
  { id: "b", title: "设置弹窗图标", level: 2 },
  { id: "c", title: "优化关闭逻辑", details: ["隐藏窗口", "恢复窗口"], level: 3 },
];

function appendSections(ids: string[]) {
  for (const id of ids) {
    const section = document.createElement("section");
    section.id = id;
    section.style.height = "1000px";
    document.body.append(section);
  }
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  private elements = new Set<Element>();

  private callback: IntersectionObserverCallback;

  root: Element | Document | null;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.root = options?.root ?? null;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.elements.add(el);
  }

  unobserve(el: Element) {
    this.elements.delete(el);
  }

  disconnect() {
    this.elements.clear();
  }

  observedIds() {
    return [...this.elements].map((el) => el.id).sort();
  }

  trigger(id: string, isIntersecting = true) {
    const target = [...this.elements].find((el) => el.id === id);

    if (!target) throw new Error(`element not observed: ${id}`);

    this.callback(
      [{ target, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

interface MountedRail {
  container: HTMLElement;
  emitted: { type: string; args: unknown[] }[];
}

function mountRail(
  items: FocusRailItem[],
  props: Record<string, unknown> = {},
  slots: Record<string, unknown> = {},
): MountedRail {
  const container = document.createElement("div");
  document.body.append(container);

  const emitted: { type: string; args: unknown[] }[] = [];
  const initialActiveId = props.activeId as string | undefined;

  const app = createApp({
    setup() {
      const state = reactive({ activeId: initialActiveId });
      return () =>
        h(
          FocusRail,
          {
            items,
            ...props,
            activeId: state.activeId,
            "onUpdate:activeId": (id: string) => {
              state.activeId = id;
              emitted.push({ type: "update:activeId", args: [id] });
            },
            onSelect: (item: FocusRailItem) => emitted.push({ type: "select", args: [item] }),
            onHover: (item: FocusRailItem) => emitted.push({ type: "hover", args: [item] }),
          },
          slots,
        );
    },
  });

  app.mount(container);
  mountedApps.push(app);
  return { container, emitted };
}

function railItems(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-slot="focus-rail-item"]')];
}

function railLines(container: HTMLElement): HTMLSpanElement[] {
  return [...container.querySelectorAll<HTMLSpanElement>('[data-slot="focus-rail-line"]')];
}

function railAside(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[data-slot="focus-rail"]')!;
}

function stubScrollIntoView() {
  const scrollIntoView = vi.fn();
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  (Element.prototype as unknown as Record<string, unknown>).scrollIntoView = scrollIntoView;
  afterEach(() => {
    if (descriptor) {
      Object.defineProperty(Element.prototype, "scrollIntoView", descriptor);
    } else {
      delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
    }
  });
  return scrollIntoView;
}

beforeEach(() => {
  MockIntersectionObserver.instances.length = 0;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("FocusRail 基础渲染", () => {
  it("为每个 item 渲染一个可聚焦的按钮，并按 level 控制横线宽度", () => {
    const items: FocusRailItem[] = [...baseItems, { id: "d", title: "无 level" }];
    const { container } = mountRail(items);

    const buttons = railItems(container);
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.tagName)).toEqual([
      "BUTTON",
      "BUTTON",
      "BUTTON",
      "BUTTON",
    ]);
    expect(buttons[0].getAttribute("aria-label")).toBe("创建 Tray");

    const lines = railLines(container);
    expect(lines[0].classList.contains("w-10")).toBe(true);
    expect(lines[1].classList.contains("w-7")).toBe(true);
    expect(lines[2].classList.contains("w-4")).toBe(true);
    // level 未指定时按中等宽度处理
    expect(lines[3].classList.contains("w-7")).toBe(true);
  });

  it("受控 activeId 正确高亮对应 item", () => {
    const { container } = mountRail(baseItems, { activeId: "b" });

    const buttons = railItems(container);
    const lines = railLines(container);

    expect(buttons[1].getAttribute("aria-current")).toBe("true");
    expect(buttons[0].getAttribute("aria-current")).toBeNull();

    expect(lines[1].classList.contains("w-7")).toBe(true);
    expect(lines[1].classList.contains("w-14")).toBe(false);
    expect(lines[1].classList.contains("bg-foreground")).toBe(true);
    expect(lines[1].classList.contains("opacity-100")).toBe(true);

    expect(lines[0].classList.contains("w-14")).toBe(false);
    expect(lines[0].classList.contains("bg-muted-foreground/30")).toBe(true);
  });

  it("hidden 到 md 以下隐藏，并应用 offsetLeft", () => {
    const { container } = mountRail(baseItems, { offsetLeft: 32 });

    const aside = railAside(container);
    expect(aside.classList.contains("hidden")).toBe(true);
    expect(aside.classList.contains("md:block")).toBe(true);
    expect(aside.style.left).toBe("32px");
  });

  it("disabled item 按钮禁用且点击无效", () => {
    const scrollIntoView = stubScrollIntoView();
    const items = [...baseItems, { id: "d", title: "禁用项", disabled: true }];
    const { container, emitted } = mountRail(items);

    const disabledButton = railItems(container).find((button) => button.dataset.railId === "d")!;
    expect(disabledButton.disabled).toBe(true);
    expect(disabledButton.classList.contains("disabled:pointer-events-none")).toBe(true);
    expect(disabledButton.classList.contains("disabled:opacity-20")).toBe(true);

    disabledButton.click();
    expect(emitted).toHaveLength(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("FocusRail 点击与滚动", () => {
  it("点击 item 依次触发 hover 之前的选择流程：select + update:activeId + scrollIntoView", () => {
    appendSections(["a", "b", "c"]);
    const scrollIntoView = stubScrollIntoView();
    const { container, emitted } = mountRail(baseItems);

    railItems(container)[2].click();

    expect(emitted).toContainEqual({ type: "select", args: [baseItems[2]] });
    expect(emitted).toContainEqual({ type: "update:activeId", args: ["c"] });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("点击后使用 targetId 定位对应节点", () => {
    appendSections(["target-x"]);
    const scrollIntoView = stubScrollIntoView();
    const items = [{ id: "x", title: "X", targetId: "target-x" }];
    const { container } = mountRail(items);

    railItems(container)[0].click();

    const section = document.getElementById("target-x")!;
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(scrollIntoView.mock.instances[0]).toBe(section);
  });

  it("scrollToTarget=false 时不滚动页面", () => {
    appendSections(["a", "b", "c"]);
    const scrollIntoView = stubScrollIntoView();
    const { container, emitted } = mountRail(baseItems, { scrollToTarget: false });

    railItems(container)[0].click();

    expect(emitted).toContainEqual({ type: "select", args: [baseItems[0]] });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("mouseenter 触发 hover emit", () => {
    const { container, emitted } = mountRail(baseItems);

    railItems(container)[1].dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));

    expect(emitted).toContainEqual({ type: "hover", args: [baseItems[1]] });
  });

  it("自定义 scrollBehavior 与 openDelay 传递给底层组件", () => {
    appendSections(["a", "b", "c"]);
    const scrollIntoView = stubScrollIntoView();
    const { container } = mountRail(baseItems, { scrollBehavior: "auto" });

    railItems(container)[0].click();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });
});

describe("FocusRail 滚动自动追踪", () => {
  it("注册 IntersectionObserver 并观察每个 target", () => {
    appendSections(["a", "b", "c"]);
    mountRail(baseItems);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].observedIds()).toEqual(["a", "b", "c"]);
  });

  it("root 传入时作为 IntersectionObserver 根元素", () => {
    const root = document.createElement("div");
    appendSections(["a", "b", "c"]);
    mountRail(baseItems, { root });

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].root).toBe(root);
  });

  it("滚动时同步新挂载的目标节点并重建 observer", async () => {
    appendSections(["a", "b"]);
    mountRail(baseItems);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].observedIds()).toEqual(["a", "b"]);

    // 目标 c 延迟挂载（虚拟化场景），滚动后应被重新观察。
    appendSections(["c"]);
    window.dispatchEvent(new Event("scroll"));

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(MockIntersectionObserver.instances).toHaveLength(2);
    expect(MockIntersectionObserver.instances[1].observedIds()).toEqual(["a", "b", "c"]);
  });

  it("autoTrack=false 时不创建 observer", () => {
    mountRail(baseItems, { autoTrack: false });

    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it("target 进入中间区域时自动更新 active", async () => {
    appendSections(["a", "b", "c"]);
    const { container, emitted } = mountRail(baseItems);
    const observer = MockIntersectionObserver.instances[0];

    observer.trigger("b", true);
    await nextTick();

    const buttons = railItems(container);
    expect(buttons[1].getAttribute("aria-current")).toBe("true");
    expect(emitted).toContainEqual({ type: "update:activeId", args: ["b"] });

    observer.trigger("c", true);
    await nextTick();
    expect(railItems(container)[2].getAttribute("aria-current")).toBe("true");
  });

  it("滚动到容器顶部或底部时选中边界 item", async () => {
    const root = document.createElement("div");
    Object.defineProperties(root, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1_000 },
    });
    appendSections(["a", "b", "c"]);
    const { container, emitted } = mountRail(baseItems, { root, activeId: "b" });

    root.scrollTop = 0;
    root.dispatchEvent(new Event("scroll"));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextTick();

    expect(railItems(container)[0].getAttribute("aria-current")).toBe("true");
    expect(emitted).toContainEqual({ type: "update:activeId", args: ["a"] });

    root.scrollTop = 600;
    root.dispatchEvent(new Event("scroll"));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextTick();

    expect(railItems(container)[2].getAttribute("aria-current")).toBe("true");
    expect(emitted).toContainEqual({ type: "update:activeId", args: ["c"] });
  });

  it("离开中间区域不改变 active", async () => {
    appendSections(["a", "b", "c"]);
    const { container, emitted } = mountRail(baseItems, { activeId: "b" });
    const observer = MockIntersectionObserver.instances[0];

    observer.trigger("b", false);
    await nextTick();

    expect(railItems(container)[1].getAttribute("aria-current")).toBe("true");
    expect(emitted).toHaveLength(0);
  });

  it("程序化滚动期间抑制 observer 更新，结束后恢复", async () => {
    vi.useFakeTimers();
    appendSections(["a", "b", "c"]);
    const { container, emitted } = mountRail(baseItems);
    const observer = MockIntersectionObserver.instances[0];

    // 点击 c 触发平滑滚动
    railItems(container)[2].click();
    await nextTick();

    expect(emitted.filter((event) => event.type === "update:activeId")).toEqual([
      { type: "update:activeId", args: ["c"] },
    ]);

    // 滚动过程中经过 a，不应把 active 切走
    observer.trigger("a", true);
    await nextTick();
    expect(emitted.filter((event) => event.type === "update:activeId")).toEqual([
      { type: "update:activeId", args: ["c"] },
    ]);

    // 500ms 后恢复自动追踪
    vi.advanceTimersByTime(501);
    observer.trigger("a", true);
    await nextTick();
    expect(emitted.filter((event) => event.type === "update:activeId")).toEqual([
      { type: "update:activeId", args: ["c"] },
      { type: "update:activeId", args: ["a"] },
    ]);
  });

  it("active 变化时保持 item 在可滚动 Rail 内可见", async () => {
    appendSections(["a", "b"]);
    const scrollTo = vi.fn();
    const { container } = mountRail([baseItems[0], baseItems[1]]);

    const scrollContainer = container.querySelector<HTMLElement>(
      '[data-slot="focus-rail-scroll"]',
    )!;
    scrollContainer.scrollTo = scrollTo;
    scrollContainer.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 600,
        left: 0,
        right: 64,
        width: 64,
        height: 500,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    const itemButton = railItems(container)[1];
    itemButton.getBoundingClientRect = () =>
      ({
        top: 10,
        bottom: 30,
        left: 0,
        right: 64,
        width: 64,
        height: 20,
        x: 0,
        y: 10,
        toJSON: () => ({}),
      }) as DOMRect;

    const observer = MockIntersectionObserver.instances[0];
    observer.trigger("b", true);
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledWith({ top: 10 - 100 - 8, behavior: "smooth" });
  });
});

describe("FocusRail HoverCard", () => {
  it("打开后展示对应 item 的标题、摘要与详情列表", async () => {
    const { container } = mountRail(baseItems, { openDelay: 0, closeDelay: 0 });

    railItems(container)[2].dispatchEvent(new FocusEvent("focus"));

    await vi.waitFor(() => {
      const content = document.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).not.toBeNull();
    });

    const content = document.body.querySelector('[data-slot="hover-card-content"]')!;
    expect(content.textContent).toContain("优化关闭逻辑");
    expect(content.textContent).toContain("隐藏窗口");
    expect(content.textContent).toContain("恢复窗口");
    expect(content.querySelector("h3")?.textContent).toBe("优化关闭逻辑");
    expect(content.querySelectorAll("li")).toHaveLength(2);
  });

  it("打开时对应横线进入 hover 高亮（非 active 时 opacity-80）", async () => {
    const { container } = mountRail(baseItems, { openDelay: 0, closeDelay: 0, activeId: "a" });

    railItems(container)[1].dispatchEvent(new FocusEvent("focus"));

    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-slot="hover-card-content"]')).not.toBeNull();
    });

    const lines = railLines(container);
    expect(lines[1].classList.contains("w-10")).toBe(true);
    expect(lines[1].classList.contains("bg-foreground")).toBe(true);
    expect(lines[1].classList.contains("opacity-80")).toBe(true);
    expect(lines[0].classList.contains("opacity-100")).toBe(true);
    expect(lines[0].classList.contains("w-7")).toBe(true);
  });

  it("快速切换 item 时始终只展示一个预览且不使用进出场动画", async () => {
    const { container } = mountRail(baseItems, { openDelay: 0, closeDelay: 180 });

    railItems(container)[0].dispatchEvent(new FocusEvent("focus"));
    await vi.waitFor(() => {
      expect(document.body.querySelector("[data-slot=hover-card-content]")?.textContent).toContain(
        "创建 Tray",
      );
    });

    railItems(container)[1].dispatchEvent(new FocusEvent("focus"));
    await vi.waitFor(() => {
      const contents = document.body.querySelectorAll<HTMLElement>(
        "[data-slot=hover-card-content]",
      );
      expect(contents).toHaveLength(1);
      expect(contents[0].textContent).toContain("设置弹窗图标");
      expect(contents[0].classList.contains("data-[state=open]:animate-in")).toBe(false);
      expect(contents[0].classList.contains("data-[state=closed]:animate-out")).toBe(false);
      expect(contents[0].classList.contains("data-[state=open]:fade-in-0")).toBe(false);
      expect(contents[0].classList.contains("data-[state=closed]:fade-out-0")).toBe(false);
    });
  });

  it("失焦后按 closeDelay 关闭", async () => {
    const { container } = mountRail(baseItems, { openDelay: 0, closeDelay: 0 });

    const trigger = railItems(container)[0];
    trigger.dispatchEvent(new FocusEvent("focus"));

    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-slot="hover-card-content"]')).not.toBeNull();
    });

    trigger.dispatchEvent(new FocusEvent("blur"));

    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-slot="hover-card-content"]')).toBeNull();
    });
  });

  it("支持 #content slot 自定义详情内容", async () => {
    const { container } = mountRail(
      baseItems,
      { openDelay: 0, closeDelay: 0 },
      {
        content: ({ item }: { item: FocusRailItem }) =>
          h("div", { "data-slot": "custom-content" }, `自定义:${item.title}`),
      },
    );

    railItems(container)[0].dispatchEvent(new FocusEvent("focus"));

    await vi.waitFor(() => {
      const custom = document.body.querySelector('[data-slot="custom-content"]');
      expect(custom).not.toBeNull();
    });

    expect(document.body.querySelector('[data-slot="custom-content"]')?.textContent).toBe(
      "自定义:创建 Tray",
    );
    expect(document.body.querySelector('[data-slot="hover-card-content"] h3')).toBeNull();
  });
});
