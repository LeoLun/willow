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
import { withPreparedSandbox } from "./sandbox-runtime.js";
import { throwIfAborted } from "./shared.js";
import type {
  BashErrorCode,
  BashToolDetails,
  SandboxMode,
  SandboxViolation,
  ToolRuntimeOptions,
} from "./types.js";

const DEFAULT_BASH_TIMEOUT_SECONDS = 120;
const MAX_BASH_TIMEOUT_SECONDS = 600;
const SENSITIVE_ENV_NAMES = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "NPM_TOKEN",
  "DATABASE_URL",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "AZURE_CLIENT_SECRET",
  "AZURE_CLIENT_CERTIFICATE_PATH",
]);
const SENSITIVE_ENV_PATTERN = /(?:^|_)(?:API_KEY|ACCESS_KEY|SECRET|TOKEN|CREDENTIALS?|PASSWORD)$/i;

const bashSchema = Type.Object({
  command: Type.String({ minLength: 1, description: "Bash command to execute" }),
  timeout: Type.Optional(
    Type.Number({
      description: `Timeout in seconds (default ${DEFAULT_BASH_TIMEOUT_SECONDS}, max ${MAX_BASH_TIMEOUT_SECONDS})`,
    }),
  ),
  interactive: Type.Optional(
    Type.Boolean({
      description:
        "Request pseudo-terminal semantics. This is human-only in non-full-access modes.",
    }),
  ),
  sandboxPermissions: Type.Optional(
    Type.Union([Type.Literal("default"), Type.Literal("elevated")]),
  ),
  justification: Type.Optional(Type.String({ maxLength: 1000 })),
  escalationToken: Type.Optional(Type.String({ minLength: 1 })),
});

export type BashToolInput = Static<typeof bashSchema>;

type ShellResult = {
  output: string;
  exitCode: number;
  sandboxMode: SandboxMode;
  violations: SandboxViolation[];
};

export class BashToolError extends Error {
  readonly violations?: SandboxViolation[];
  readonly escalationToken?: string;

  constructor(
    readonly code: BashErrorCode,
    message: string,
    details?: { violations?: SandboxViolation[]; escalationToken?: string },
  ) {
    super(`${code}: ${message}`);
    this.name = "BashToolError";
    this.violations = details?.violations;
    this.escalationToken = details?.escalationToken;
  }
}

function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function interactiveCommand(command: string): string {
  return `/usr/bin/script -q /dev/null /bin/bash -c ${quoteShellArgument(command)}`;
}

function safeEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (SENSITIVE_ENV_NAMES.has(name) || SENSITIVE_ENV_PATTERN.test(name)) delete environment[name];
  }
  return environment;
}

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
  spawnCommand?: string;
  cwd: string;
  timeout: number;
  sandboxMode: SandboxMode;
  signal?: AbortSignal;
  onUpdate?: AgentToolUpdateCallback<BashToolDetails>;
}): Promise<ShellResult> {
  throwIfAborted(options.signal);
  return await new Promise<ShellResult>((resolvePromise, rejectPromise) => {
    const child = spawn(
      "/bin/bash",
      [
        options.sandboxMode === "full-access" ? "-lc" : "-c",
        options.spawnCommand ?? options.command,
      ],
      {
        cwd: options.cwd,
        detached: true,
        env: safeEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
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
          sandboxMode: options.sandboxMode,
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
      settle(() => rejectPromise(new BashToolError("ABORTED", "Operation aborted")));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) =>
      settle(() => rejectPromise(new BashToolError("SPAWN_FAILED", error.message))),
    );
    child.on("close", (code) =>
      settle(() =>
        resolvePromise({
          output,
          exitCode: code ?? 1,
          sandboxMode: options.sandboxMode,
          violations: [],
        }),
      ),
    );
    options.signal?.addEventListener("abort", onAbort, { once: true });
    timeoutHandle = setTimeout(() => {
      killProcess(child.pid);
      settle(() =>
        rejectPromise(
          new BashToolError("TIMEOUT", `Command timed out after ${options.timeout} seconds`),
        ),
      );
    }, options.timeout * 1000);
  });
}

async function formatResult(command: string, result: ShellResult) {
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
      kind: "bash" as const,
      command,
      exitCode: result.exitCode,
      lineCount: truncation.totalLines,
      sandboxMode: result.sandboxMode,
      sandboxViolations: result.violations.length ? result.violations : undefined,
      truncation: truncation.truncated ? truncation : undefined,
      fullOutputPath,
    },
  };
}

export class BashTool extends ToolBase<typeof bashSchema, BashToolDetails> {
  readonly name = "bash";
  readonly label = "bash";
  readonly description =
    "Execute a Bash command. Non-full-access modes use a workspace-write OS sandbox. " +
    "If the sandbox blocks required access, retry the exact command with the returned token, " +
    'sandboxPermissions="elevated", and a concise justification.';
  readonly parameters = bashSchema;
  override readonly executionMode = "sequential";
  private readonly validatedEscalations = new Map<string, SandboxViolation[]>();

  protected override checkParams(input: BashToolInput): Error | undefined {
    if (input.command.trim() === "") return new Error("command must not be empty");
    if (
      input.timeout !== undefined &&
      (!Number.isFinite(input.timeout) ||
        input.timeout <= 0 ||
        input.timeout > MAX_BASH_TIMEOUT_SECONDS)
    ) {
      return new Error(
        `Invalid timeout: must be positive and at most ${MAX_BASH_TIMEOUT_SECONDS} seconds`,
      );
    }
    if (input.justification !== undefined && input.justification.length > 1000) {
      return new Error("justification must be at most 1000 characters");
    }
    if (input.sandboxPermissions === "elevated") {
      if (!input.justification?.trim()) return new Error("justification is required for elevated");
      if (!input.escalationToken) return new Error("escalationToken is required for elevated");
    } else if (input.justification !== undefined || input.escalationToken !== undefined) {
      return new Error("justification and escalationToken require sandboxPermissions=elevated");
    }
    return undefined;
  }

  protected override async preAuthorize(
    context: ToolExecutionContext<BashToolInput, BashToolDetails>,
  ): Promise<void> {
    if (context.input.sandboxPermissions !== "elevated") return;
    const token = context.input.escalationToken!;
    const violations = this.options.escalationStore.validate(
      token,
      context.input.command,
      this.options.cwd,
    );
    this.options.escalationStore.consume(token);
    if (!violations) {
      throw new BashToolError("PERMISSION_DENIED", "Invalid or expired sandbox escalation token");
    }
    context.permissionDecision.reason.metadata = { violations };
    context.permissionDecision.requestedPermissions = {
      ...context.permissionDecision.requestedPermissions,
      violations,
    };
    this.validatedEscalations.set(context.toolCallId, violations);
  }

  protected override async finalize(
    context: ToolExecutionContext<BashToolInput, BashToolDetails>,
  ): Promise<void> {
    this.validatedEscalations.delete(context.toolCallId);
  }

  protected override async run(context: ToolExecutionContext<BashToolInput, BashToolDetails>) {
    const { input, signal, onUpdate } = context;
    const timeout = input.timeout ?? DEFAULT_BASH_TIMEOUT_SECONDS;
    const elevated = input.sandboxPermissions === "elevated";
    if (elevated && !this.validatedEscalations.delete(context.toolCallId)) {
      throw new Error("Sandbox escalation was not validated");
    }

    let result: ShellResult;
    if (context.permissionMode === "full-access" || elevated) {
      result = await runShell({
        command: input.command,
        cwd: this.options.cwd,
        timeout,
        sandboxMode: "full-access",
        signal,
        onUpdate,
      });
    } else {
      try {
        const sandboxCommand = input.interactive
          ? interactiveCommand(input.command)
          : input.command;
        result = await withPreparedSandbox(
          {
            cwd: this.options.cwd,
            agentDir: this.options.agentDir,
            command: sandboxCommand,
            commandId: context.toolCallId,
            policy: this.options.sandboxPolicy,
            signal,
            allowPty: input.interactive,
          },
          async (prepared) => {
            const executed = await runShell({
              command: input.command,
              spawnCommand: prepared.command,
              cwd: this.options.cwd,
              timeout,
              sandboxMode: "workspace-write",
              signal,
              onUpdate,
            });
            return { ...executed, violations: prepared.violations() };
          },
        );
      } catch (error) {
        if (error instanceof BashToolError) throw error;
        if (signal?.aborted) throw new BashToolError("ABORTED", "Operation aborted");
        throw new BashToolError(
          "SANDBOX_UNAVAILABLE",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const denied = result.exitCode !== 0 && result.violations.length > 0;
    await this.options.permissionEventSink?.({
      type: "sandbox",
      sessionId: this.options.sessionId,
      toolCallId: context.toolCallId,
      mode: result.sandboxMode,
      denied,
      violations: result.violations,
    });
    if (denied) {
      const token = this.options.escalationStore.create(
        input.command,
        this.options.cwd,
        result.violations,
      );
      const summary = result.violations.map((violation) => violation.message).join("\n");
      throw new BashToolError(
        "SANDBOX_DENIED",
        `The command was blocked by workspace-write sandbox.\n${summary}\n\n` +
          `Escalation token: ${token}\nRetry this exact command with ` +
          'sandboxPermissions="elevated" and a concise justification.',
        { violations: result.violations, escalationToken: token },
      );
    }

    const formatted = await formatResult(input.command, result);
    if (result.exitCode !== 0) {
      throw new BashToolError(
        "COMMAND_FAILED",
        `${formatted.text}\n\nCommand exited with code ${result.exitCode}`,
      );
    }
    return this.buildResponse([{ type: "text", text: formatted.text }], formatted.details);
  }
}

export function createBashTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof bashSchema, BashToolDetails> {
  return new BashTool(options);
}
