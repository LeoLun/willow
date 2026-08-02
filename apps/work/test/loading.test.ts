// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "vue";
import Loading from "../src/renderer/src/components/ui/Loading.vue";

const mountedApps: ReturnType<typeof createApp>[] = [];

function mountLoading(rootProps?: Record<string, unknown>): HTMLElement {
  const container = document.createElement("div");
  const app = createApp(Loading, rootProps);
  app.mount(container);
  mountedApps.push(app);
  return container;
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
});

describe("Loading", () => {
  it("renders an accessible 3-by-3 dot grid", () => {
    const container = mountLoading();
    const loading = container.querySelector<HTMLElement>('[data-slot="loading"]');
    const dots = container.querySelectorAll('[data-slot="loading-dot"]');

    expect(loading?.getAttribute("role")).toBe("status");
    expect(loading?.getAttribute("aria-label")).toBe("正在加载");
    expect(loading?.classList.contains("size-10.5")).toBe(true);
    expect(dots).toHaveLength(9);
    expect([...dots].every((dot) => dot.getAttribute("aria-hidden") === "true")).toBe(true);
    expect([...dots].every((dot) => dot.classList.contains("size-full"))).toBe(true);
  });

  it("staggers dots diagonally and accepts root attributes", () => {
    const container = mountLoading({
      class: "custom-loading size-4",
      "aria-label": "正在同步",
    });
    const loading = container.querySelector<HTMLElement>('[data-slot="loading"]');
    const dots = container.querySelectorAll<HTMLElement>('[data-slot="loading-dot"]');

    expect(loading?.classList.contains("custom-loading")).toBe(true);
    expect(loading?.classList.contains("size-4")).toBe(true);
    expect(loading?.classList.contains("size-10.5")).toBe(false);
    expect(loading?.getAttribute("aria-label")).toBe("正在同步");
    expect([...dots].map((dot) => dot.style.animationDelay)).toEqual([
      "0ms",
      "200ms",
      "400ms",
      "200ms",
      "400ms",
      "600ms",
      "400ms",
      "600ms",
      "800ms",
    ]);
  });
});
