const BOARD_EDITOR_CHANNEL = "willow-board-editor";

export function createBoardEditorBridgeScript(tabId: string, enabled: boolean): string {
  return `(${installBoardEditorBridge.toString()})(${JSON.stringify(tabId)}, ${JSON.stringify(enabled)});`;
}

function installBoardEditorBridge(tabId: string, enabled: boolean): void {
  const bridgeKey = "__willowBoardEditorBridge__";
  const channel = "willow-board-editor";
  const hoverClass = "willow-board-node-hover";
  const selectedClass = "willow-board-node-selected";
  const bridgeWindow = window as typeof window & {
    [bridgeKey]?: { cleanup: () => void };
  };

  bridgeWindow[bridgeKey]?.cleanup();
  if (!enabled) return;

  const eligibleTags = new Set([
    "a",
    "article",
    "button",
    "canvas",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "input",
    "label",
    "li",
    "p",
    "section",
    "select",
    "summary",
    "table",
    "td",
    "textarea",
    "th",
    "tr",
  ]);
  let hovered: Element | undefined;
  let selected: Element | undefined;
  let positionFrame = 0;

  const style = document.createElement("style");
  style.dataset.willowBoardEditor = "true";
  style.textContent = `
    .${hoverClass} {
      outline: 2px dashed #8b5cf6 !important;
      outline-offset: -2px !important;
      cursor: crosshair !important;
    }
    .${selectedClass} {
      outline: 2px solid #7c3aed !important;
      outline-offset: -2px !important;
    }
  `;
  (document.head ?? document.documentElement).append(style);

  function normalizeText(value: string | null | undefined, limit: number): string {
    const normalized = (value ?? "").replace(/\s+/g, " ").trim();
    return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
  }

  function escapeCss(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  }

  function isUnique(selector: string): boolean {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  function isCandidate(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (
      !eligibleTags.has(tag) ||
      element === document.body ||
      element === document.documentElement
    ) {
      return false;
    }
    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.pointerEvents === "none"
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return normalizeText(element.textContent, 2).length > 0 || element.childElementCount > 0;
  }

  function findCandidate(target: EventTarget | null): Element | undefined {
    let element = target instanceof Element ? target : undefined;
    while (element && element !== document.body && element !== document.documentElement) {
      if (isCandidate(element)) return element;
      element = element.parentElement ?? undefined;
    }
    return undefined;
  }

  function createSelector(element: Element): string {
    const boardNode = element.getAttribute("data-board-node");
    if (boardNode) {
      const selector = `[data-board-node="${escapeCss(boardNode)}"]`;
      if (isUnique(selector)) return selector;
    }
    if (element.id) {
      const selector = `#${escapeCss(element.id)}`;
      if (isUnique(selector)) return selector;
    }

    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase();
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter(
            (sibling) => sibling.tagName === current!.tagName,
          )
        : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${Math.max(index, 1)})`);
      const selector = parts.join(" > ");
      if (isUnique(selector)) return selector;
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function createReference(element: Element) {
    const tag = element.tagName.toLowerCase();
    const label = normalizeText(
      element.getAttribute("data-board-node") ??
        element.id ??
        element.getAttribute("aria-label") ??
        element.getAttribute("title") ??
        element.textContent ??
        tag,
      64,
    );
    return {
      path: ".agents/panel/index.html",
      selector: createSelector(element),
      tag,
      label: label || tag,
      summary: normalizeText(element.textContent, 180),
    };
  }

  function post(type: string, extra: Record<string, unknown> = {}): void {
    parent.postMessage({ channel, tabId, type, ...extra }, "*");
  }

  function clearHovered(): void {
    hovered?.classList.remove(hoverClass);
    hovered = undefined;
  }

  function clearSelected(notify = false): void {
    selected?.classList.remove(selectedClass);
    selected = undefined;
    if (notify) post("cleared");
  }

  function postSelectionPosition(): void {
    if (!selected?.isConnected) {
      clearSelected(true);
      return;
    }
    const rect = selected.getBoundingClientRect();
    post("selected", {
      rect: { right: rect.right, top: rect.top },
      reference: createReference(selected),
    });
  }

  function schedulePositionUpdate(): void {
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(postSelectionPosition);
  }

  function handlePointerOver(event: Event): void {
    const candidate = findCandidate(event.target);
    if (candidate === hovered) return;
    clearHovered();
    if (!candidate || candidate === selected) return;
    candidate.classList.add(hoverClass);
    hovered = candidate;
  }

  function handlePointerLeave(): void {
    clearHovered();
  }

  function handleClick(event: Event): void {
    const candidate = findCandidate(event.target);
    if (!candidate) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (candidate === selected) {
      clearSelected(true);
      return;
    }
    clearHovered();
    clearSelected();
    selected = candidate;
    selected.classList.add(selectedClass);
    postSelectionPosition();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") post("exit");
  }

  function handleMessage(event: MessageEvent): void {
    if (event.source !== parent || !event.data || typeof event.data !== "object") return;
    const data = event.data as { channel?: unknown; tabId?: unknown; type?: unknown };
    if (data.channel !== channel || data.tabId !== tabId) return;
    if (data.type === "clear") clearSelected(true);
  }

  function cleanup(): void {
    cancelAnimationFrame(positionFrame);
    clearHovered();
    clearSelected();
    style.remove();
    document.removeEventListener("pointerover", handlePointerOver, true);
    document.removeEventListener("pointerleave", handlePointerLeave, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
    window.removeEventListener("scroll", schedulePositionUpdate, true);
    window.removeEventListener("resize", schedulePositionUpdate);
    window.removeEventListener("message", handleMessage);
    delete bridgeWindow[bridgeKey];
  }

  document.addEventListener("pointerover", handlePointerOver, true);
  document.addEventListener("pointerleave", handlePointerLeave, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("scroll", schedulePositionUpdate, true);
  window.addEventListener("resize", schedulePositionUpdate);
  window.addEventListener("message", handleMessage);
  bridgeWindow[bridgeKey] = { cleanup };
  post("ready");
}

export { BOARD_EDITOR_CHANNEL };
