import { access } from "fs/promises";
import { relative } from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import glob from "glob";
import { resolveToCwd } from "./path-utils";

const DEFAULT_LIMIT = 1000;
const MAX_OUTPUT_BYTES = 256 * 1024;

const findSchema = Type.Object({
  pattern: Type.String({
    description: "Glob 模式，例如 '*.ts'、'**/*.spec.ts'",
  }),
  path: Type.Optional(Type.String({ description: "搜索根目录（默认：当前目录）" })),
  limit: Type.Optional(Type.Number({ description: `最多返回路径数（默认 ${DEFAULT_LIMIT}）` })),
});

function displayPrefix(cwd: string, root: string): string {
  const p = relative(cwd, root).replace(/\\/g, "/");
  if (p === "" || p === ".") return "";
  return p;
}

export function createFindTool(cwd: string): AgentTool<typeof findSchema> {
  return {
    name: "find",
    label: "查找",
    description:
      "在目录下按 glob 列出匹配的文件路径。忽略 node_modules 与 .git。路径在可能时相对于代理工作目录显示。",
    parameters: findSchema,
    async execute(_toolCallId, params) {
      const { pattern, path: searchDir, limit } = params;
      const root = resolveToCwd(searchDir ?? ".", cwd);
      try {
        await access(root);
      } catch {
        throw new Error(`路径不存在：${searchDir ?? "."}`);
      }

      const effectiveLimit = Math.max(1, limit ?? DEFAULT_LIMIT);
      const raw = glob.sync(pattern, {
        cwd: root,
        nodir: true,
        dot: true,
        ignore: ["**/node_modules/**", "**/.git/**"],
      });
      const matches = raw.slice(0, effectiveLimit);

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: "没有匹配该模式的文件" }],
          details: undefined,
        };
      }

      const pre = displayPrefix(cwd, root);
      const lines = matches.map((m: string) => {
        const norm = m.replace(/\\/g, "/");
        return pre ? `${pre}/${norm}` : norm;
      });

      let body = lines.join("\n");
      if (Buffer.byteLength(body, "utf-8") > MAX_OUTPUT_BYTES) {
        body = body.slice(0, MAX_OUTPUT_BYTES) + `\n\n[约在 ${MAX_OUTPUT_BYTES / 1024}KB 处截断]`;
      }
      if (raw.length >= effectiveLimit) {
        body += `\n\n[结果条数上限 ${effectiveLimit}]`;
      }

      return { content: [{ type: "text", text: body }], details: undefined };
    },
  };
}
