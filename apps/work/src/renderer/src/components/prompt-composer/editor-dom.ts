const BLOCK_ELEMENTS = new Set(["DIV", "P"]);

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) {
    return Array.from(node.childNodes, serializeNode).join("");
  }

  const tokenSource = node.getAttribute("data-token-source");
  if (tokenSource !== null) return tokenSource;
  // Chromium may insert a BR only to keep a caret next to a non-editable token.
  // Real newlines are stored as text nodes by PromptComposer.
  if (node.tagName === "BR") return "";

  const content = Array.from(node.childNodes, serializeNode).join("");
  return BLOCK_ELEMENTS.has(node.tagName) && content !== "" ? `${content}\n` : content;
}

export function serializeComposerDom(root: Node): string {
  const content = Array.from(root.childNodes, serializeNode).join("");
  const lastChild = root.lastChild;
  return lastChild instanceof Element && BLOCK_ELEMENTS.has(lastChild.tagName)
    ? content.slice(0, -1)
    : content;
}

export interface SourceSelection {
  start: number;
  end: number;
}

export function getSourceSelection(root: HTMLElement): SourceSelection | undefined {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return undefined;

  const startRange = document.createRange();
  startRange.setStart(root, 0);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = document.createRange();
  endRange.setStart(root, 0);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: serializeComposerDom(startRange.cloneContents()).length,
    end: serializeComposerDom(endRange.cloneContents()).length,
  };
}

type DomPosition = { node: Node; offset: number };

function findDomPosition(root: Node, target: number): DomPosition {
  let consumed = 0;

  function visit(node: Node): DomPosition | undefined {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (target <= consumed + length) return { node, offset: Math.max(0, target - consumed) };
      consumed += length;
      return undefined;
    }

    if (node instanceof Element) {
      const tokenSource = node.getAttribute("data-token-source");
      if (tokenSource !== null) {
        const parent = node.parentNode;
        if (!parent) return undefined;
        const index = Array.prototype.indexOf.call(parent.childNodes, node) as number;
        if (target <= consumed) return { node: parent, offset: index };
        consumed += tokenSource.length;
        if (target <= consumed) return { node: parent, offset: index + 1 };
        return undefined;
      }
      if (node.tagName === "BR") {
        const parent = node.parentNode;
        if (!parent) return undefined;
        const index = Array.prototype.indexOf.call(parent.childNodes, node) as number;
        if (target <= consumed) return { node: parent, offset: index };
        return { node: parent, offset: index + 1 };
      }
    }

    for (const child of node.childNodes) {
      const position = visit(child);
      if (position) return position;
    }
    return undefined;
  }

  return visit(root) ?? { node: root, offset: root.childNodes.length };
}

export function restoreSourceSelection(root: HTMLElement, selection: SourceSelection): void {
  const start = findDomPosition(root, selection.start);
  const end = findDomPosition(root, selection.end);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const browserSelection = window.getSelection();
  browserSelection?.removeAllRanges();
  browserSelection?.addRange(range);
}
