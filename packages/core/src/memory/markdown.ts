import type { MemoryDocument, MemoryScope } from "./types.js";

export function parseMemoryDocument(text: string): MemoryDocument {
  if (text.includes("\0") || text.includes("\uFFFD"))
    throw new Error("Memory must be valid UTF-8 Markdown");
  const document: MemoryDocument = { preamble: "", sections: [] };
  let fence: { char: string; length: number } | undefined;
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*?)(?:\r?\n)?$/.exec(line);
    const inFence = fence !== undefined;
    if (marker) {
      if (!fence) fence = { char: marker[1]![0]!, length: marker[1]!.length };
      else if (
        marker[1]![0] === fence.char &&
        marker[1]!.length >= fence.length &&
        !marker[2]!.trim()
      )
        fence = undefined;
    }
    const heading = !inFence && !marker ? /^## ([^\r\n]+?)(?:\r?\n)?$/.exec(line) : null;
    if (heading) {
      const name = heading[1]!.trim();
      if (!name || document.sections.some((section) => section.name === name))
        throw new Error(`Duplicate or empty memory section: ${name}`);
      document.sections.push({ name, content: "" });
    } else {
      const section = document.sections[document.sections.length - 1];
      if (section) section.content += line;
      else document.preamble += line;
    }
  }
  if (fence) throw new Error("Memory contains an unclosed code fence");
  return document;
}

export function serializeMemoryDocument(document: MemoryDocument): string {
  const newline = document.preamble.includes("\r\n") ? "\r\n" : "\n";
  let text = document.preamble;
  for (const section of document.sections) {
    if (text && !text.endsWith("\n")) text += newline;
    text += `## ${section.name}${newline}${section.content}`;
  }
  return text;
}

export function createDefaultMemory(scope: MemoryScope): string {
  const names = scope === "global" ? ["User", "Agent"] : ["Project", "Architecture", "Conventions"];
  return `# Memory\n\n${names.map((name) => `## ${name}\n\n`).join("")}`;
}

export function validateMemoryUpdate(input: {
  section: string;
  oldText?: string;
  newText: string;
}): void {
  if (
    !input.section.trim() ||
    /[\r\n]/.test(input.section) ||
    input.section.includes("\0") ||
    input.section !== input.section.trim()
  )
    throw new Error("section must be a non-empty single-line name without surrounding whitespace");
  if (input.oldText !== undefined && !input.oldText.length)
    throw new Error("oldText must not be empty");
  if (input.oldText === undefined && !input.newText.trim())
    throw new Error("newText must not be empty when appending");
}
