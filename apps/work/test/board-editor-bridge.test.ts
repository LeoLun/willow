// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOARD_EDITOR_CHANNEL,
  createBoardEditorBridgeScript,
} from "../src/main/service/board-editor-bridge";

afterEach(() => {
  window.eval(createBoardEditorBridgeScript("board-tab", false));
  document.body.replaceChildren();
});

describe("board editor bridge", () => {
  it("selects nodes in the existing document and cleans up without replacing it", async () => {
    document.body.innerHTML = `
      <main><section data-board-node="overview"><span>Project overview</span></section></main>
    `;
    const originalDocument = document;
    const section = document.querySelector<HTMLElement>("section")!;
    vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 80,
      left: 10,
      right: 310,
      top: 40,
      width: 300,
      x: 10,
      y: 40,
      toJSON: () => ({}),
    });
    const messages: Record<string, unknown>[] = [];
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.channel === BOARD_EDITOR_CHANNEL) messages.push(event.data);
    };
    window.addEventListener("message", handleMessage);

    window.eval(createBoardEditorBridgeScript("board-tab", true));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    section.querySelector("span")!.dispatchEvent(click);

    await vi.waitFor(() =>
      expect(messages).toContainEqual(
        expect.objectContaining({
          reference: expect.objectContaining({
            label: "overview",
            selector: '[data-board-node="overview"]',
            summary: "Project overview",
          }),
          tabId: "board-tab",
          type: "selected",
        }),
      ),
    );
    expect(click.defaultPrevented).toBe(true);
    expect(section.classList).toContain("willow-board-node-selected");
    expect(document).toBe(originalDocument);

    window.eval(createBoardEditorBridgeScript("board-tab", false));
    expect(section.classList).not.toContain("willow-board-node-selected");
    expect(document.querySelector("style[data-willow-board-editor]")).toBeNull();
    window.removeEventListener("message", handleMessage);
  });
});
