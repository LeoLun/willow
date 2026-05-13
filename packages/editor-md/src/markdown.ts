import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import type { ParseSpec } from "prosemirror-markdown";

const markdownTokens: Record<string, ParseSpec> = {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "listItem" },
  bullet_list: { block: "bulletList" },
  ordered_list: {
    block: "orderedList",
    getAttrs: (token) => ({
      start: Number(token.attrGet("start")) || 1,
    }),
  },
  heading: {
    block: "heading",
    getAttrs: (token) => ({
      level: Number(token.tag.slice(1)) || 1,
    }),
  },
  code_block: { block: "codeBlock", noCloseToken: true },
  fence: {
    block: "codeBlock",
    getAttrs: (token) => ({
      language: token.info || null,
    }),
    noCloseToken: true,
  },
  hr: { node: "horizontalRule" },
  hardbreak: { node: "hardBreak" },
  image: { ignore: true, noCloseToken: true },
  em: { mark: "italic" },
  strong: { mark: "bold" },
  link: {
    mark: "link",
    getAttrs: (token) => ({
      href: token.attrGet("href"),
      title: token.attrGet("title") || null,
    }),
  },
  code_inline: { mark: "code", noCloseToken: true },
};

const markdownSerializer = new MarkdownSerializer(
  {
    blockquote: defaultMarkdownSerializer.nodes.blockquote,
    codeBlock(state, node) {
      const backticks = node.textContent.match(/`{3,}/gm);
      const fence = backticks ? `${backticks.sort().slice(-1)[0]}\`` : "```";
      const language = node.attrs.language || "";

      state.write(`${fence}${language}\n`);
      state.text(node.textContent, false);
      state.write("\n");
      state.write(fence);
      state.closeBlock(node);
    },
    heading: defaultMarkdownSerializer.nodes.heading,
    horizontalRule: defaultMarkdownSerializer.nodes.horizontal_rule,
    bulletList(state, node) {
      state.renderList(node, "  ", () => "- ");
    },
    orderedList(state, node) {
      const start = node.attrs.start || 1;
      const maxWidth = String(start + node.childCount - 1).length;
      const space = state.repeat(" ", maxWidth + 2);

      state.renderList(node, space, (index) => {
        const number = String(start + index);

        return `${state.repeat(" ", maxWidth - number.length)}${number}. `;
      });
    },
    listItem: defaultMarkdownSerializer.nodes.list_item,
    paragraph: defaultMarkdownSerializer.nodes.paragraph,
    hardBreak: defaultMarkdownSerializer.nodes.hard_break,
    text: defaultMarkdownSerializer.nodes.text,
  },
  {
    bold: defaultMarkdownSerializer.marks.strong,
    italic: defaultMarkdownSerializer.marks.em,
    link: defaultMarkdownSerializer.marks.link,
    code: defaultMarkdownSerializer.marks.code,
  },
  {
    hardBreakNodeName: "hardBreak",
    strict: false,
  },
);

export function parseMarkdownToTiptapContent(markdown: string, schema: Schema): ProseMirrorNode {
  const parser = new MarkdownParser(schema, defaultMarkdownParser.tokenizer, markdownTokens);
  const doc = parser.parse(markdown.trim() ? markdown : "");

  return doc;
}

export function serializeTiptapDocToMarkdown(doc: ProseMirrorNode): string {
  if (!doc.textContent.trim() && doc.childCount <= 1) {
    return "";
  }

  return markdownSerializer.serialize(doc).trimEnd();
}
