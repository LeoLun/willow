import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { Type } from "@sinclair/typebox";
import { createTool } from "./create-tool";
import { isPathInsideCwd, resolveToCwd } from "./path-utils";

export interface WriteToolDetails {
  absolutePath: string;
  bytesWritten: number;
  lineCount: number;
}

const writeSchema = Type.Object({
  path: Type.String({ description: "要写入的文件路径" }),
  content: Type.String({ description: "要写入的内容" }),
});

export function createWriteTool(cwd: string) {
  return createTool({
    name: "write",
    label: "写入文件",
    description: "将内容写入文件。必要时自动创建父目录。会覆盖已存在文件。",
    parameters: writeSchema,
    meta: {
      label: "写入文件",
      permission: (params) =>
        isPathInsideCwd(params.path, cwd)
          ? { mode: "allow" }
          : {
              mode: "ask",
              title: `是否允许执行 写入 ${params.path}`,
              reason: "写入文件会修改工作区内容",
              risk: "high",
            },
    },
    async execute(_toolCallId, params) {
      const { path, content } = params;
      const absolutePath = resolveToCwd(path, cwd);
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
  });
}
