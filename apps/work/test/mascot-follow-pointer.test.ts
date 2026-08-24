// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { AxolotlMascot } from "../src/renderer/src/components/Mascot/Mascot";

const mountedApps: App[] = [];
let animationFrames: FrameRequestCallback[] = [];
let animationTime = 0;

async function advanceAnimation(frameCount: number): Promise<void> {
  for (let index = 0; index < frameCount; index += 1) {
    const callback = animationFrames.shift();
    if (!callback) throw new Error("mascot animation frame was not scheduled");
    animationTime += 64;
    callback(animationTime);
  }
  await nextTick();
}

function eyeCenterX(svg: SVGSVGElement): number {
  const eyes = [...svg.querySelectorAll<SVGPathElement>("mask path[transform]")];
  if (eyes.length === 0) throw new Error("mascot eyes were not rendered");

  const centers = eyes.map((eye) => {
    const matrix = eye.getAttribute("transform")?.match(/^matrix\((.+)\)$/)?.[1];
    if (!matrix) throw new Error("mascot eye transform is not a matrix");
    return Number(matrix.split(",")[4]);
  });
  return centers.reduce((total, center) => total + center, 0) / centers.length;
}

beforeEach(() => {
  animationFrames = [];
  animationTime = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("AxolotlMascot pointer following", () => {
  it("looks toward the side containing the pointer", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({
      render: () => h(AxolotlMascot, { followPointer: true }),
    });
    app.mount(container);
    mountedApps.push(app);

    const svg = container.querySelector<SVGSVGElement>("svg");
    if (!svg) throw new Error("mascot SVG was not rendered");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 620,
      height: 240,
      left: 392,
      right: 632,
      top: 380,
      width: 240,
      x: 392,
      y: 380,
      toJSON: () => ({}),
    });

    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 1000, clientY: 500 }));
    await advanceAnimation(20);
    const horizontalCenterX = eyeCenterX(svg);
    expect(horizontalCenterX).toBeGreaterThan(0);

    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 1000, clientY: 0 }));
    await advanceAnimation(2);
    const diagonalCenterX = eyeCenterX(svg);
    expect(diagonalCenterX).toBeGreaterThan(0);
    expect(diagonalCenterX).toBeLessThan(horizontalCenterX);

    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 24, clientY: 500 }));
    await advanceAnimation(2);
    expect(eyeCenterX(svg)).toBeLessThan(0);
  });
});
