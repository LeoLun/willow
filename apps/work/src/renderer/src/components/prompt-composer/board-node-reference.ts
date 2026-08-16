export const BOARD_PANEL_PATH = ".agents/panel/index.html";

const BOARD_NODE_TAGS = new Set([
  "a",
  "article",
  "aside",
  "button",
  "dd",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "nav",
  "p",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
]);

const LABEL_MAX_LENGTH = 48;
const SUMMARY_MAX_LENGTH = 180;

export interface BoardNodeReference {
  path: string;
  selector: string;
  tag: string;
  label: string;
  summary: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function escapeBoardNodeValue(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function unescapeBoardNodeValue(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function serializeBoardNodeReference(reference: BoardNodeReference): string {
  const attributes = [
    `path="${escapeBoardNodeValue(reference.path)}"`,
    `selector="${escapeBoardNodeValue(reference.selector)}"`,
    `tag="${escapeBoardNodeValue(reference.tag)}"`,
    `label="${escapeBoardNodeValue(reference.label)}"`,
  ].join(" ");
  return `<board-node ${attributes}>${escapeBoardNodeValue(reference.summary)}</board-node>`;
}

function cssIdentifier(value: string): string {
  const escape = globalThis.CSS?.escape;
  if (escape) return escape(value);
  return value.replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, (character, leadingDigit: string) =>
    leadingDigit ? `\\3${character} ` : `\\${character}`,
  );
}

function cssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function isUniqueSelector(document: Document, selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function stableSelector(element: Element): string | undefined {
  const document = element.ownerDocument;
  const boardNode = normalizeText(element.getAttribute("data-board-node"));
  if (boardNode) {
    const selector = `[data-board-node="${cssAttributeValue(boardNode)}"]`;
    if (isUniqueSelector(document, selector)) return selector;
  }
  const id = element.id;
  if (id) {
    const selector = `#${cssIdentifier(id)}`;
    if (isUniqueSelector(document, selector)) return selector;
  }
  return undefined;
}

function selectorSegment(element: Element): string {
  const tag = element.tagName.toLocaleLowerCase();
  const parent = element.parentElement;
  if (!parent) return tag;
  const siblings = [...parent.children].filter(
    (candidate) => candidate.tagName === element.tagName,
  );
  if (siblings.length === 1) return tag;
  return `${tag}:nth-of-type(${siblings.indexOf(element) + 1})`;
}

export function createBoardNodeSelector(element: Element): string {
  const direct = stableSelector(element);
  if (direct) return direct;

  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName.toLocaleLowerCase() !== "body") {
    const stable = stableSelector(current);
    if (stable) {
      segments.unshift(stable);
      return segments.join(" > ");
    }
    segments.unshift(selectorSegment(current));
    const selector = segments.join(" > ");
    if (isUniqueSelector(element.ownerDocument, selector)) return selector;
    current = current.parentElement;
  }
  return `body > ${segments.join(" > ")}`;
}

function isVisibleContentElement(element: Element): boolean {
  const tag = element.tagName.toLocaleLowerCase();
  if (!BOARD_NODE_TAGS.has(tag)) return false;
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  if (style?.display === "none" || style?.visibility === "hidden") return false;
  const text = normalizeText(element.textContent);
  return text !== "" || element.querySelector("img, canvas, video, svg") !== null;
}

export function findBoardNodeCandidate(target: EventTarget | null): Element | undefined {
  let current =
    target && "nodeType" in target && target.nodeType === 1 ? (target as Element) : null;
  while (current && current.tagName.toLocaleLowerCase() !== "body") {
    if (isVisibleContentElement(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

function getBoardNodeLabel(element: Element): string {
  const explicit = [
    element.getAttribute("aria-label"),
    element.getAttribute("data-board-node"),
    element.id,
  ].find((value) => normalizeText(value) !== "");
  if (explicit) return truncate(normalizeText(explicit), LABEL_MAX_LENGTH);
  const heading = element.matches("h1, h2, h3, h4, h5, h6")
    ? element
    : element.querySelector("h1, h2, h3, h4, h5, h6");
  const text = normalizeText(heading?.textContent ?? element.textContent);
  return truncate(text || element.tagName.toLocaleLowerCase(), LABEL_MAX_LENGTH);
}

export function createBoardNodeReference(element: Element): BoardNodeReference {
  return {
    path: BOARD_PANEL_PATH,
    selector: createBoardNodeSelector(element),
    tag: element.tagName.toLocaleLowerCase(),
    label: getBoardNodeLabel(element),
    summary: truncate(normalizeText(element.textContent), SUMMARY_MAX_LENGTH),
  };
}
