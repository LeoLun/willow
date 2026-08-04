import type { ComarkNode, ComarkPlugin } from "@comark/vue";

const DOM_ATTRIBUTE_NAME = /^[A-Za-z_:][A-Za-z0-9_.:-]*$/;

// Comark treats any trailing `{...}` as component attributes. Assistant prose commonly uses the
// same syntax for object shapes, so escape it outside code and math before the MDC parser sees it.
function escapeAttributeLikeBraces(value: string): string {
  return value.replace(/(?<!\\)\{([^{}\n]*)\}/g, (_match, content: string) => {
    const escapedContent = content.replace(/(?<!\\)\[\]/g, "\\[\\]");
    return `\\{${escapedContent}\\}`;
  });
}

function escapeComarkAttributeSyntax(markdown: string): string {
  let result = "";
  let plainText = "";
  let fenceMarker = "";

  const flushPlainText = () => {
    result += escapeAttributeLikeBraces(plainText);
    plainText = "";
  };

  for (const line of markdown.match(/.*(?:\n|$)/g) ?? []) {
    if (!line) continue;
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMarker) {
      result += line;
      if (fence?.[1]?.[0] === fenceMarker[0] && fence[1].length >= fenceMarker.length) {
        fenceMarker = "";
      }
      continue;
    }
    if (fence?.[1]) {
      flushPlainText();
      fenceMarker = fence[1];
      result += line;
      continue;
    }

    for (let index = 0; index < line.length; ) {
      const marker = line[index];
      if (marker !== "`" && marker !== "$") {
        plainText += marker;
        index += 1;
        continue;
      }

      const markerLength =
        marker === "`"
          ? (line.slice(index).match(/^`+/)?.[0].length ?? 1)
          : line[index + 1] === "$"
            ? 2
            : 1;
      const delimiter = marker.repeat(markerLength);
      const closingIndex = line.indexOf(delimiter, index + markerLength);
      if (closingIndex === -1) {
        plainText += line.slice(index);
        break;
      }

      flushPlainText();
      result += line.slice(index, closingIndex + markerLength);
      index = closingIndex + markerLength;
    }
  }

  flushPlainText();
  return result;
}

function removeInvalidAttributes(node: ComarkNode): void {
  if (typeof node === "string") return;
  const attributes = node[1];
  for (const name of Object.keys(attributes)) {
    if (name !== "$" && !DOM_ATTRIBUTE_NAME.test(name)) delete attributes[name];
  }
  for (const child of node.slice(2) as ComarkNode[]) removeInvalidAttributes(child);
}

export const comarkSafety = (): ComarkPlugin => ({
  name: "willow-comark-safety",
  pre(state) {
    state.markdown = escapeComarkAttributeSyntax(state.markdown);
  },
  post(state) {
    // Keep a final renderer boundary in case a future parser form bypasses the text escaping.
    for (const node of state.tree.nodes) removeInvalidAttributes(node);
  },
});
