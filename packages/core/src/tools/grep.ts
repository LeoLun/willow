import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { resolveToCwd } from "./path-utils";

const DEFAULT_LIMIT = 100;
const MAX_OUTPUT_BYTES = 256 * 1024;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "target"]);

export interface GrepToolDetails {
  searchRoot: string;
  matchCount: number;
  matchLimitReached: boolean;
  outputByteTruncated: boolean;
}

const grepSchema = Type.Object({
  pattern: Type.String({ description: "搜索模式（JavaScript 正则）" }),
  path: Type.Optional(Type.String({ description: "要搜索的文件或目录（默认：当前目录）" })),
  ignoreCase: Type.Optional(Type.Boolean({ description: "忽略大小写（默认 false）" })),
  limit: Type.Optional(Type.Number({ description: `最多匹配条数（默认 ${DEFAULT_LIMIT}）` })),
});

function compileRegex(pattern: string, ignoreCase: boolean): RegExp {
  try {
    return new RegExp(pattern, ignoreCase ? "gi" : "g");
  } catch (e: any) {
    throw new Error(`无效正则：${e.message}`);
  }
}

async function* walkFiles(root: string): AsyncGenerator<string> {
  const s = await stat(root);
  if (s.isFile()) {
    yield root;
    return;
  }
  if (!s.isDirectory()) return;

  const entries = await readdir(root, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = join(root, ent.name);
    if (ent.isDirectory()) yield* walkFiles(full);
    else if (ent.isFile()) yield full;
  }
}

export function createGrepTool(cwd: string): AgentTool<typeof grepSchema> {
  return {
    name: "grep",
    label: "内容搜索",
    description: "在路径下用正则搜索文件内容。跳过 node_modules、.git 等。输出大小有上限。",
    parameters: grepSchema,
    async execute(_toolCallId, params, signal) {
      const { pattern, path: searchPath, ignoreCase, limit } = params;
      const root = resolveToCwd(searchPath ?? ".", cwd);
      const regex = compileRegex(pattern, ignoreCase ?? false);
      const maxMatches = Math.max(1, limit ?? DEFAULT_LIMIT);
      const linesOut: string[] = [];
      let matches = 0;
      let truncated = false;

      const pushLine = (line: string) => {
        linesOut.push(line);
        const bytes = Buffer.byteLength(linesOut.join("\n"), "utf-8");
        if (bytes > MAX_OUTPUT_BYTES) {
          truncated = true;
          linesOut.pop();
        }
      };

      for await (const file of walkFiles(root)) {
        if (signal?.aborted) throw new Error("操作已中止");
        if (matches >= maxMatches) break;

        let text: string;
        try {
          const buf = await readFile(file);
          if (buf.includes(0)) continue; // skip binary
          text = buf.toString("utf-8");
        } catch {
          continue;
        }

        const rel = relative(cwd, file).replace(/\\/g, "/") || file;
        const fileLines = text.split(/\r?\n/);
        regex.lastIndex = 0;

        for (let i = 0; i < fileLines.length; i++) {
          if (matches >= maxMatches) break;
          const line = fileLines[i]!;
          regex.lastIndex = 0;
          if (!regex.test(line)) continue;
          matches++;
          pushLine(`${rel}:${i + 1}: ${line}`);
          if (truncated) break;
        }
        if (truncated || matches >= maxMatches) break;
      }

      let body = linesOut.join("\n");
      if (matches === 0) body = "无匹配";
      if (matches >= maxMatches) body += `\n\n[已达匹配条数上限 ${maxMatches}]`;
      if (truncated) body += `\n\n[输出约在 ${MAX_OUTPUT_BYTES / 1024}KB 处截断]`;

      const details: GrepToolDetails = {
        searchRoot: root,
        matchCount: matches,
        matchLimitReached: matches >= maxMatches,
        outputByteTruncated: truncated,
      };

      return { content: [{ type: "text", text: body }], details };
    },
  };
}
