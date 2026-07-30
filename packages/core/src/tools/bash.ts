import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SandboxViolationEvent } from "@carderne/sandbox-runtime";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateTail,
  type AgentTool,
  type AgentToolUpdateCallback,
} from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { canonicalMutationPath, isSensitiveWritePath } from "./policy.js";
import { type SandboxGrants, withPreparedSandbox } from "./sandbox-runtime.js";
import { throwIfAborted } from "./shared.js";
import type { BashToolDetails, ToolRuntimeOptions } from "./types.js";

const bashSchema = Type.Object({
  command: Type.String({ description: "Bash command to execute" }),
  timeout: Type.Optional(
    Type.Number({ description: "Timeout in seconds (optional, no default timeout)" }),
  ),
});

export type BashToolInput = Static<typeof bashSchema>;

type ShellResult = {
  output: string;
  exitCode: number;
  sandboxDenied: boolean;
  deniedDomains?: string[];
  violations?: SandboxViolationEvent[];
};

const MAX_SANDBOX_APPROVALS = 16;
const APPLICATION_LAUNCH_DENIAL_MARKERS = [
  "lsopen",
  "appleevent-send",
  "mach-lookup com.apple.coreservices.appleevents",
  "mach-lookup com.apple.coreservices.coreservicesd",
  "mach-lookup com.apple.coreservices.quarantine-resolver",
] as const;

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

function looksLikeSandboxDenial(output: string): boolean {
  return /operation not permitted|sandbox(?:-exec)?:.*(?:deny|denied)|permission denied/i.test(
    output,
  );
}

async function runShell(options: {
  command: string;
  spawnCommand?: string;
  cwd: string;
  timeout?: number;
  sandboxed: boolean;
  signal?: AbortSignal;
  onUpdate?: AgentToolUpdateCallback<BashToolDetails>;
}): Promise<ShellResult> {
  throwIfAborted(options.signal);

  const args = [options.sandboxed ? "-c" : "-lc", options.spawnCommand ?? options.command];
  const executable = "/bin/bash";

  return await new Promise<ShellResult>((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
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
          sandboxed: options.sandboxed,
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
    child.on("close", (code) =>
      settle(() =>
        resolvePromise({
          output,
          exitCode: code ?? 1,
          sandboxDenied: options.sandboxed && looksLikeSandboxDenial(output),
        }),
      ),
    );

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

async function runSandboxedShell(options: {
  command: string;
  cwd: string;
  agentDir?: string;
  timeout?: number;
  policy: ToolRuntimeOptions["sandboxPolicy"];
  grants: SandboxGrants;
  signal?: AbortSignal;
  onUpdate?: AgentToolUpdateCallback<BashToolDetails>;
}): Promise<ShellResult> {
  return await withPreparedSandbox(
    {
      cwd: options.cwd,
      agentDir: options.agentDir,
      command: options.command,
      policy: options.policy,
      grants: options.grants,
      signal: options.signal,
    },
    async (prepared) => {
      const result = await runShell({
        command: options.command,
        spawnCommand: prepared.command,
        cwd: options.cwd,
        timeout: options.timeout,
        sandboxed: true,
        signal: options.signal,
        onUpdate: options.onUpdate,
      });
      return {
        ...result,
        deniedDomains: [...new Set(prepared.deniedDomains)],
        violations: prepared.getViolations(),
      };
    },
  );
}

function extractViolationWritePath(
  violations: readonly SandboxViolationEvent[],
): string | undefined {
  for (const violation of violations) {
    const match = violation.line.match(
      /deny(?:\(\d+\))?\s+file-write[^\s]*\s+(?:"([^"]+)"|([^\s]+))/i,
    );
    const path = match?.[1] ?? match?.[2];
    if (path?.startsWith("/")) return path;
  }
  return undefined;
}

function extractBlockedWritePath(result: ShellResult): string | undefined {
  const violationPath = extractViolationWritePath(result.violations ?? []);
  if (violationPath) return violationPath;
  const match = result.output.match(
    /(?:\/bin\/bash|bash|sh): (?:line \d+: )?([^\n:]+): (?:Operation not permitted|Permission denied)/i,
  );
  return match?.[1]?.trim();
}

function hasApplicationLaunchViolation(violations: readonly SandboxViolationEvent[]): boolean {
  return violations.some((violation) => {
    const line = violation.line.toLocaleLowerCase().replace(/"/g, "");
    return (
      /deny(?:\(\d+\))?\s/.test(line) &&
      APPLICATION_LAUNCH_DENIAL_MARKERS.some((marker) => line.includes(marker))
    );
  });
}

async function formatResult(
  command: string,
  sandboxed: boolean,
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
      sandboxed,
      truncation: truncation.truncated ? truncation : undefined,
      fullOutputPath,
    },
  };
}

export class BashTool extends ToolBase<typeof bashSchema, BashToolDetails> {
  readonly name = "bash";
  readonly label = "bash";
  readonly description =
    "Execute a bash command. Output is truncated to the last 2000 lines or 50KB.";
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
    const shouldSandbox = this.options.permissionMode !== "full-access";
    let result: ShellResult;
    if (!shouldSandbox) {
      result = await runShell({
        command: input.command,
        cwd: this.options.cwd,
        timeout: input.timeout,
        sandboxed: false,
        signal,
        onUpdate,
      });
    } else {
      const grants: SandboxGrants = {
        readPaths: [],
        writePaths: [],
        domains: [],
        allowAppleEvents: false,
      };
      let approvals = 0;
      while (true) {
        result = await runSandboxedShell({
          command: input.command,
          cwd: this.options.cwd,
          agentDir: this.options.agentDir,
          timeout: input.timeout,
          policy: this.options.sandboxPolicy,
          grants,
          signal,
          onUpdate,
        });

        const deniedDomain = result.deniedDomains?.find(
          (domain) => !grants.domains.includes(domain),
        );
        if (deniedDomain) {
          if (approvals >= MAX_SANDBOX_APPROVALS) {
            throw new Error("Too many sandbox permission requests for one command");
          }
          await this.requestPermission(context, {
            reason: "network-domain",
            display: deniedDomain,
            mayHavePartialEffects: true,
          });
          grants.domains.push(deniedDomain);
          approvals += 1;
          continue;
        }

        const blockedWritePath = extractBlockedWritePath(result);
        if (blockedWritePath) {
          const canonicalPath = await canonicalMutationPath(this.options.cwd, blockedWritePath);
          if (
            grants.writePaths.includes(canonicalPath) ||
            (await isSensitiveWritePath(
              this.options.cwd,
              canonicalPath,
              this.options.sandboxPolicy,
            ))
          ) {
            throw new Error(`Sensitive or hard-blocked write denied for ${canonicalPath}`);
          }
          if (approvals >= MAX_SANDBOX_APPROVALS) {
            throw new Error("Too many sandbox permission requests for one command");
          }
          await this.requestPermission(context, {
            reason: "outside-workspace-write",
            display: canonicalPath,
            mayHavePartialEffects: true,
          });
          grants.writePaths.push(canonicalPath);
          approvals += 1;
          continue;
        }

        if (!grants.allowAppleEvents && hasApplicationLaunchViolation(result.violations ?? [])) {
          if (approvals >= MAX_SANDBOX_APPROVALS) {
            throw new Error("Too many sandbox permission requests for one command");
          }
          await this.requestPermission(context, {
            reason: "application-launch",
            display: input.command,
            mayHavePartialEffects: true,
          });
          grants.allowAppleEvents = true;
          approvals += 1;
          continue;
        }
        break;
      }
    }

    const formatted = await formatResult(input.command, shouldSandbox, result);
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
