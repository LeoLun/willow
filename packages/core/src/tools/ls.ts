import { readdir, stat } from "fs/promises";
import { join } from "path";
import { Type } from "@sinclair/typebox";
import { createTool } from "./create-tool";
import { resolveToCwd } from "./path-utils";

const DEFAULT_LIMIT = 500;
const MAX_OUTPUT_BYTES = 64 * 1024;

export interface LsToolDetails {
  absolutePath: string;
  totalEntries: number;
  returned: number;
  entryLimitReached: boolean;
  outputByteTruncated: boolean;
}

const lsSchema = Type.Object({
  path: Type.Optional(Type.String({ description: "要列出的目录（默认：当前目录）" })),
  limit: Type.Optional(Type.Number({ description: `最多条目数（默认 ${DEFAULT_LIMIT}）` })),
});

export function createLsTool(cwd: string) {
  return createTool({
    name: "ls",
    label: "列出目录",
    description: "列出单个目录下的文件与子目录（非递归）。",
    parameters: lsSchema,
    meta: {
      label: "列出目录",
      permission: () => ({ mode: "allow" }),
    },
    async execute(_toolCallId, params) {
      const { path: dirPath, limit } = params;
      const root = resolveToCwd(dirPath ?? ".", cwd);
      const entries = await readdir(root, { withFileTypes: true });
      const max = Math.max(1, limit ?? DEFAULT_LIMIT);

      const rows: string[] = [];
      for (const ent of entries.slice(0, max)) {
        const full = join(root, ent.name);
        let suffix = "";
        try {
          const s = await stat(full);
          suffix = s.isDirectory() ? "/" : "";
        } catch {
          suffix = "?";
        }
        rows.push(`${ent.name}${suffix}`);
      }

      let body = rows.join("\n");
      const entryLimitReached = entries.length > max;
      if (entryLimitReached) {
        body += `\n\n[仅显示 ${max} 条，共 ${entries.length} 条]`;
      }
      let outputByteTruncated = false;
      if (Buffer.byteLength(body, "utf-8") > MAX_OUTPUT_BYTES) {
        body = body.slice(0, MAX_OUTPUT_BYTES) + "\n\n[已截断]";
        outputByteTruncated = true;
      }

      const details: LsToolDetails = {
        absolutePath: root,
        totalEntries: entries.length,
        returned: Math.min(entries.length, max),
        entryLimitReached,
        outputByteTruncated,
      };

      return {
        content: [{ type: "text", text: body || "（空）" }],
        details,
      };
    },
  });
}
