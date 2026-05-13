import { constants } from "fs";
import { readFile, writeFile, access } from "fs/promises";
import { Type } from "@sinclair/typebox";
import { createTool } from "./create-tool";
import { isPathInsideCwd, resolveToCwd } from "./path-utils";

export interface EditToolDetails {
  absolutePath: string;
  bytesBefore: number;
  bytesAfter: number;
  /** 极简 unified diff 预览；完整 diff 字符串见 pi `EditToolDetails.diff` + `computeEditDiff` */
  diff: string;
}

/** 参数名与 pi-mono 的 `edit` schema 一致：`oldText` / `newText`。 */
const editSchema = Type.Object({
  path: Type.String({
    description: "要编辑的文件路径（相对或绝对）",
  }),
  oldText: Type.String({
    description: "要查找并替换的原文（须与文件内容完全一致，含空白与换行）",
  }),
  newText: Type.String({ description: "替换后的文本" }),
});

export function createEditTool(cwd: string) {
  return createTool({
    name: "edit",
    label: "编辑文件",
    description: "通过精确字符串替换编辑文件。oldText 必须与原文完全一致且仅出现一次。请先 read。",
    parameters: editSchema,
    meta: {
      label: "编辑文件",
      permission: (params) =>
        isPathInsideCwd(params.path, cwd)
          ? { mode: "allow" }
          : {
              mode: "ask",
              title: `是否允许执行 编辑 ${params.path}`,
              reason: "编辑文件会修改工作区内容",
              risk: "high",
            },
    },
    async execute(_toolCallId, params) {
      const { path, oldText, newText } = params;
      const absolutePath = resolveToCwd(path, cwd);
      await access(absolutePath, constants.R_OK | constants.W_OK);

      const content = await readFile(absolutePath, "utf-8");

      if (oldText === newText) {
        throw new Error("oldText 与 newText 相同");
      }

      const occurrences = content.split(oldText).length - 1;

      if (occurrences === 0) {
        throw new Error(`在 ${path} 中未找到 oldText。请完全匹配原文，包括空白与换行。`);
      }

      if (occurrences > 1) {
        throw new Error(
          `oldText 在 ${path} 中出现 ${occurrences} 次，必须唯一匹配——请增加更多上下文。`,
        );
      }

      const newContent = content.replace(oldText, newText);
      await writeFile(absolutePath, newContent, "utf-8");

      const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n)}…`);
      const diff = [
        `--- ${path}`,
        `+++ ${path}`,
        `@@ replacement (1 occurrence) @@`,
        `-${clip(oldText, 120)}`,
        `+${clip(newText, 120)}`,
      ].join("\n");
      const details: EditToolDetails = {
        absolutePath,
        bytesBefore: Buffer.byteLength(content, "utf-8"),
        bytesAfter: Buffer.byteLength(newContent, "utf-8"),
        diff,
      };

      return {
        content: [{ type: "text", text: `已编辑 ${path}：替换 1 处` }],
        details,
      };
    },
  });
}
