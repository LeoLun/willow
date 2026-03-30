import { constants } from "fs";
import { readFile, access } from "fs/promises";
import { resolve } from "path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

export interface ReadToolDetails {
  absolutePath: string;
  totalLines: number;
  linesShown: number;
  startLine1Indexed: number;
  truncatedByLineCap: boolean;
  truncatedByByteCap: boolean;
  hasMoreLinesAfter: boolean;
}

const MAX_LINES = 2000;
const MAX_BYTES = 256 * 1024;

const readSchema = Type.Object({
  path: Type.String({ description: "文件路径（相对或绝对）" }),
  offset: Type.Optional(Type.Number({ description: "起始行号（从 1 开始）" })),
  limit: Type.Optional(Type.Number({ description: "最多读取行数" })),
});

export function createReadTool(cwd: string): AgentTool<typeof readSchema> {
  return {
    name: "read",
    label: "读取文件",
    description: `读取文件内容。输出最多 ${MAX_LINES} 行或 ${MAX_BYTES / 1024}KB。大文件请使用 offset/limit。`,
    parameters: readSchema,
    async execute(toolCallId, params, _signal, _onUpdate) {
      const { path, offset, limit } = params;
      const absolutePath = resolve(cwd, path);
      await access(absolutePath, constants.R_OK);

      const buffer = await readFile(absolutePath);
      const text = buffer.toString("utf-8");
      const allLines = text.split("\n");

      const startLine = offset ? Math.max(0, offset - 1) : 0;
      if (startLine >= allLines.length) {
        throw new Error(`offset ${offset} 超出文件末尾（共 ${allLines.length} 行）`);
      }

      const endLine = limit ? Math.min(startLine + limit, allLines.length) : allLines.length;
      let selectedLines = allLines.slice(startLine, endLine);
      let truncatedByLineCap = false;
      let truncatedByByteCap = false;

      // 截断保护
      if (selectedLines.length > MAX_LINES) {
        selectedLines = selectedLines.slice(0, MAX_LINES);
        truncatedByLineCap = true;
      }

      let output = selectedLines.join("\n");
      if (Buffer.byteLength(output, "utf-8") > MAX_BYTES) {
        while (Buffer.byteLength(output, "utf-8") > MAX_BYTES && selectedLines.length > 1) {
          selectedLines.pop();
          output = selectedLines.join("\n");
        }
      }

      const remaining = allLines.length - (startLine + selectedLines.length);
      if (remaining > 0) {
        output += `\n\n[还有 ${remaining} 行。使用 offset=${startLine + selectedLines.length + 1} 继续读取。]`;
      }

      const hasMoreLinesAfter = remaining > 0;
      if (hasMoreLinesAfter) {
        output += `\n\n[还有 ${remaining} 行。使用 offset=${startLine + selectedLines.length + 1} 继续读取。]`;
      }

      const details: ReadToolDetails = {
        absolutePath,
        totalLines: allLines.length,
        linesShown: selectedLines.length,
        startLine1Indexed: startLine + 1,
        truncatedByLineCap,
        truncatedByByteCap,
        hasMoreLinesAfter,
      };

      return { content: [{ type: "text", text: output }], details };
    },
  };
}
