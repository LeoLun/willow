import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { throwIfAborted } from "./shared.js";
import type { BaseDetails, ToolRuntimeOptions } from "./types.js";

const execFileAsync = promisify(execFile);
const PROCESS_LIST_COMMAND = "/bin/ps -axo pid=,ppid=,user=,etime=,command=";

export const processListSchema = Type.Object({
  filter: Type.Optional(
    Type.String({
      maxLength: 200,
      description: "Case-insensitive text filter applied to complete process rows",
    }),
  ),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 200, description: "Maximum rows to return (default 50)" }),
  ),
});

export type ProcessListInput = Static<typeof processListSchema>;

export interface ProcessListToolDetails extends BaseDetails {
  kind: "processList";
  processCount: number;
  returnedCount: number;
  truncated: boolean;
  filter?: string;
}

export class ProcessListTool extends ToolBase<typeof processListSchema, ProcessListToolDetails> {
  readonly name = "processList";
  readonly label = "processList";
  readonly description =
    "List host processes with a fixed read-only ps invocation. Requires explicit process-inspection approval outside full-access mode.";
  readonly parameters = processListSchema;

  protected override async checkPermission(
    context: ToolExecutionContext<ProcessListInput, ProcessListToolDetails>,
  ): Promise<void> {
    if (this.options.permissionMode === "full-access") return;
    await this.requestPermission(context, {
      reason: "process-inspection",
      display: PROCESS_LIST_COMMAND,
    });
  }

  protected override async run(
    context: ToolExecutionContext<ProcessListInput, ProcessListToolDetails>,
  ) {
    throwIfAborted(context.signal);
    let stdout: string;
    try {
      const result = await execFileAsync("/bin/ps", ["-axo", "pid=,ppid=,user=,etime=,command="], {
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        signal: context.signal,
      });
      stdout = result.stdout;
    } catch (error) {
      if (context.signal?.aborted) throw new Error("Operation aborted");
      throw error;
    }

    const filter = context.input.filter?.trim();
    const normalizedFilter = filter?.toLocaleLowerCase();
    const rows = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !normalizedFilter || line.toLocaleLowerCase().includes(normalizedFilter));
    const limit = context.input.limit ?? 50;
    const returnedRows = rows.slice(0, limit);
    const text = returnedRows.length > 0 ? returnedRows.join("\n") : "No matching processes.";

    return this.buildResponse([{ type: "text", text }], {
      msg: filter ? `查看匹配 ${filter} 的进程` : "查看系统进程",
      kind: "processList",
      processCount: rows.length,
      returnedCount: returnedRows.length,
      truncated: rows.length > returnedRows.length,
      filter: filter || undefined,
    });
  }
}

export function createProcessListTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof processListSchema, ProcessListToolDetails> {
  return new ProcessListTool(options);
}
