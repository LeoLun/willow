import { writeFile, mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

export interface WriteToolDetails {
  absolutePath: string;
  bytesWritten: number;
  lineCount: number;
}

const writeSchema = Type.Object({
  path: Type.String({ description: "要写入的文件路径" }),
  content: Type.String({ description: "要写入的内容" }),
});

export function createWriteTool(cwd: string): AgentTool<typeof writeSchema> {
  return {
    name: "write",
    label: "写入文件",
    description: "将内容写入文件。必要时自动创建父目录。会覆盖已存在文件。",
    parameters: writeSchema,
    async execute(_toolCallId, params) {
      const { path, content } = params;
      const absolutePath = resolve(cwd, path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, "utf-8");

      const lineCount = content.split("\n").length;
      const bytesWritten = Buffer.byteLength(content, "utf-8");

      const details: WriteToolDetails = {
        absolutePath,
        bytesWritten,
        lineCount,
      };

      return {
        content: [{ type: "text", text: `已写入 ${lineCount} 行到 ${path}` }],
        details,
      };
    },
  };
}
