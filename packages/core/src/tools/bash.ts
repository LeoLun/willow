import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateTail,
  type AgentTool,
  type AgentToolUpdateCallback,
} from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { throwIfAborted } from "./shared.js";
import type { BashToolDetails, ToolRuntimeOptions } from "./types.js";

const bashSchema = Type.Object({
  command: Type.String({ description: "Bash command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default 120)" })),
  interactive: Type.Optional(
    Type.Boolean({
      description:
        "Retained for schema compatibility; execution is no longer sandboxed and the option has no effect.",
    }),
  ),
});

export type BashToolInput = Static<typeof bashSchema>;

type ShellResult = {
  output: string;
  exitCode: number;
};

const DEFAULT_BASH_TIMEOUT_SECONDS = 120;

function killProcess(pid: number | undefined): void {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Process already exited.
    }
  }
}

async function runShell(options: {
  command: string;
  cwd: string;
  timeout?: number;
  signal?: AbortSignal;
  onUpdate?: AgentToolUpdateCallback<BashToolDetails>;
}): Promise<ShellResult> {
  throwIfAborted(options.signal);

  return await new Promise<ShellResult>((resolvePromise, rejectPromise) => {
    const child = spawn("/bin/bash", ["-lc", options.command], {
      cwd: options.cwd,
      detached: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const settle = (operation: () => void) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      options.signal?.removeEventListener("abort", onAbort);
      operation();
    };
    const emitUpdate = () => {
      if (!options.onUpdate) return;
      const truncation = truncateTail(output);
      options.onUpdate({
        content: [{ type: "text", text: truncation.content }],
        details: {
          msg: `执行 ${options.command}`,
          kind: "bash",
          command: options.command,
          exitCode: 0,
          lineCount: truncation.totalLines,
          truncation: truncation.truncated ? truncation : undefined,
        },
      });
    };
    const onData = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      emitUpdate();
    };
    const onAbort = () => {
      killProcess(child.pid);
      settle(() => rejectPromise(new Error("Operation aborted")));
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => settle(() => rejectPromise(error)));
    child.on("close", (code) => settle(() => resolvePromise({ output, exitCode: code ?? 1 })));

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }
    if (options.timeout !== undefined) {
      timeoutHandle = setTimeout(() => {
        killProcess(child.pid);
        settle(() =>
          rejectPromise(new Error(`Command timed out after ${options.timeout} seconds`)),
        );
      }, options.timeout * 1000);
    }
  });
}

async function formatResult(
  command: string,
  result: ShellResult,
): Promise<{ text: string; details: BashToolDetails }> {
  const truncation = truncateTail(result.output, {
    maxBytes: DEFAULT_MAX_BYTES,
    maxLines: DEFAULT_MAX_LINES,
  });
  let text = truncation.content || "(no output)";
  let fullOutputPath: string | undefined;
  if (truncation.truncated) {
    const directory = await mkdtemp(join(tmpdir(), "willow-bash-"));
    fullOutputPath = join(directory, "output.log");
    await writeFile(fullOutputPath, result.output, "utf8");
    text += `\n\n[Output truncated. Full output: ${fullOutputPath}]`;
  }
  return {
    text,
    details: {
      msg: `执行 ${command}`,
      kind: "bash",
      command,
      exitCode: result.exitCode,
      lineCount: truncation.totalLines,
      truncation: truncation.truncated ? truncation : undefined,
      fullOutputPath,
    },
  };
}

export class BashTool extends ToolBase<typeof bashSchema, BashToolDetails> {
  readonly name = "bash";
  readonly label = "bash";
  readonly description =
    "Execute a bash command with a default 120-second timeout. Output is truncated to the last 2000 lines or 50KB.";
  readonly parameters = bashSchema;
  override readonly executionMode = "sequential";

  protected override checkParams(input: BashToolInput): Error | undefined {
    if (input.timeout !== undefined && (!Number.isFinite(input.timeout) || input.timeout <= 0)) {
      return new Error("Invalid timeout: must be a positive finite number");
    }
    return undefined;
  }

  protected override async run(context: ToolExecutionContext<BashToolInput, BashToolDetails>) {
    const { input, signal, onUpdate } = context;
    const timeout = input.timeout ?? DEFAULT_BASH_TIMEOUT_SECONDS;
    const result = await runShell({
      command: input.command,
      cwd: this.options.cwd,
      timeout,
      signal,
      onUpdate,
    });
    const formatted = await formatResult(input.command, result);
    if (result.exitCode !== 0) {
      throw new Error(`${formatted.text}\n\nCommand exited with code ${result.exitCode}`);
    }
    return this.buildResponse([{ type: "text", text: formatted.text }], formatted.details);
  }
}

export function createBashTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof bashSchema, BashToolDetails> {
  return new BashTool(options);
}
