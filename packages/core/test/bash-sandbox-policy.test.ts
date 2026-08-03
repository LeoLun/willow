import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const sandbox = vi.hoisted(() => {
  let config: {
    network: {
      allowedDomains: string[];
      strictAllowlist?: boolean;
      allowLocalBinding: boolean;
    };
    filesystem: { allowRead: string[]; allowWrite: string[]; denyWrite: string[] };
    allowAppleEvents: boolean;
    allowBrowserProcess: boolean;
    allowPty: boolean;
  };
  let ask: ((input: { host: string; port?: number }) => Promise<boolean>) | undefined;
  let violations: { line: string; command: string; timestamp: Date }[] = [];
  const configs: (typeof config)[] = [];
  return {
    configs,
    initialize: vi.fn(async (nextConfig, nextAsk) => {
      config = nextConfig;
      ask = nextAsk;
      configs.push(structuredClone(nextConfig));
    }),
    wrapWithSandbox: vi.fn(async (command: string) => {
      violations = [];
      if (command === "network-attempt") {
        if (!config.network.allowedDomains.includes("example.com")) {
          if (!config.network.strictAllowlist) {
            await ask?.({ host: "example.com", port: 443 });
          }
          return "printf 'network denied' >&2; exit 1";
        }
        return "printf 'network allowed'";
      }
      if (command.startsWith("write-attempt:")) {
        const path = command.slice("write-attempt:".length);
        if (!config.filesystem.allowWrite.includes(path)) {
          violations = [
            {
              line: `bash(123) deny(1) file-write-create "${path}"`,
              command,
              timestamp: new Date(),
            },
          ];
          return `printf 'bash: ${path}: Operation not permitted\\n' >&2; exit 1`;
        }
        return `printf 'allowed' > ${JSON.stringify(path)}`;
      }
      if (command.startsWith("install-attempt:")) {
        const path = command.slice("install-attempt:".length);
        if (!config.filesystem.allowWrite.includes(path)) {
          violations = [
            {
              line: `bash(123) deny(1) file-write-create "${path}"`,
              command,
              timestamp: new Date(),
            },
          ];
          return `printf 'bash: ${path}: Operation not permitted\\n' >&2; exit 1`;
        }
        return "printf 'allowed'";
      }
      if (command.startsWith("stubborn-write:")) {
        const path = command.slice("stubborn-write:".length);
        violations = [
          {
            line: `bash(123) deny(1) file-write-create "${path}"`,
            command,
            timestamp: new Date(),
          },
        ];
        return `printf 'bash: ${path}: Operation not permitted\\n' >&2; exit 1`;
      }
      if (command.startsWith("read-attempt:")) {
        const path = command.slice("read-attempt:".length);
        if (!config.filesystem.allowRead.includes(path)) {
          violations = [
            {
              line: `bash(123) deny(1) file-read-data "${path}"`,
              command,
              timestamp: new Date(),
            },
          ];
          return `printf 'bash: ${path}: Operation not permitted\\n' >&2; exit 1`;
        }
        return "printf 'allowed'";
      }
      if (command === "process-attempt") {
        violations = [
          {
            line: "ps(123) deny(1) process-info-pidinfo",
            command,
            timestamp: new Date(),
          },
        ];
        return "printf 'process denied' >&2; exit 1";
      }
      if (command === "local-binding-attempt") {
        if (!config.network.allowLocalBinding) {
          violations = [
            {
              line: "node(123) deny(1) network-bind *:3210",
              command,
              timestamp: new Date(),
            },
          ];
          return "printf 'binding denied' >&2; exit 1";
        }
        return "printf 'binding allowed'";
      }
      if (command.includes("pty-attempt")) {
        if (!config.allowPty) {
          violations = [
            {
              line: 'script(123) deny(1) file-write-data "/dev/ptmx"',
              command,
              timestamp: new Date(),
            },
          ];
          return "printf 'pty denied' >&2; exit 1";
        }
        return "printf 'pty allowed'";
      }
      if (command === "application-attempt" || command === "application-hard-failure") {
        if (!config.allowAppleEvents) {
          violations = [
            {
              line: 'open(123) deny(1) mach-lookup "com.apple.CoreServices.coreservicesd"',
              command,
              timestamp: new Date(),
            },
          ];
          return "printf 'application denied' >&2; exit 1";
        }
        return command === "application-attempt"
          ? "printf 'application allowed'"
          : "printf 'application still failed' >&2; exit 1";
      }
      if (command === "output-only-process-denial") {
        return "printf '/bin/bash: /bin/ps: Operation not permitted' >&2; exit 1";
      }
      if (command.startsWith("multi-attempt:")) {
        const path = command.slice("multi-attempt:".length);
        if (!config.network.allowedDomains.includes("example.com")) {
          if (!config.network.strictAllowlist) {
            await ask?.({ host: "example.com", port: 443 });
          }
          return "printf 'network denied' >&2; exit 1";
        }
        if (!config.filesystem.allowWrite.includes(path)) {
          violations = [
            {
              line: `bash(123) deny(1) file-write-create "${path}"`,
              command,
              timestamp: new Date(),
            },
          ];
          return `printf 'bash: ${path}: Operation not permitted\\n' >&2; exit 1`;
        }
        if (!config.allowAppleEvents) {
          violations = [
            {
              line: "open(123) deny(1) lsopen",
              command,
              timestamp: new Date(),
            },
          ];
          return "printf 'application denied' >&2; exit 1";
        }
        return "printf 'all allowed'";
      }
      return "printf 'Operation not permitted' >&2; exit 1";
    }),
    cleanupAfterCommand: vi.fn(),
    reset: vi.fn(async () => undefined),
    violationStore: {
      clear: vi.fn(() => {
        violations = [];
      }),
      getViolationsForCommand: vi.fn((command: string) =>
        violations.filter((violation) => violation.command === command),
      ),
    },
  };
});

vi.mock("@carderne/sandbox-runtime", () => ({
  SandboxManager: {
    initialize: sandbox.initialize,
    wrapWithSandbox: sandbox.wrapWithSandbox,
    cleanupAfterCommand: sandbox.cleanupAfterCommand,
    reset: sandbox.reset,
    getSandboxViolationStore: () => sandbox.violationStore,
  },
}));

import { createBashTool, type ToolApprovalHandler } from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  sandbox.configs.length = 0;
  vi.clearAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(path);
  return path;
}

async function workspaceTemporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(process.cwd(), prefix));
  temporaryDirectories.push(path);
  return path;
}

describe("bash sandbox policy", () => {
  it("allows read and write access to both system temporary directory roots", async () => {
    const cwd = await temporaryDirectory("willow-temporary-policy-");
    const slashTmp = realpathSync("/tmp");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");
    const result = await createBashTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("temporary-directories", { command: `read-attempt:${slashTmp}` });

    const expectedRoots = [realpathSync(tmpdir()), slashTmp];
    expect(sandbox.configs).toHaveLength(1);
    expect(sandbox.configs[0].filesystem.allowRead).toEqual(expect.arrayContaining(expectedRoots));
    expect(sandbox.configs[0].filesystem.allowWrite).toEqual(expect.arrayContaining(expectedRoots));
    expect(requestApproval).not.toHaveBeenCalled();
    expect(result.content).toEqual([{ type: "text", text: "allowed" }]);
  });

  it("allows read and write access to the global Willow skills directory", async () => {
    const cwd = await temporaryDirectory("willow-global-skills-policy-");
    const agentDir = ".custom-willow";
    const globalSkillsDirectory = join(homedir(), agentDir, "skills");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createBashTool({
      cwd,
      agentDir,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("global-skills", {
      command: `read-attempt:${globalSkillsDirectory}`,
    });

    expect(sandbox.configs).toHaveLength(1);
    expect(sandbox.configs[0].filesystem.allowRead).toContain(globalSkillsDirectory);
    expect(sandbox.configs[0].filesystem.allowWrite).toContain(globalSkillsDirectory);
    expect(sandbox.configs[0].filesystem.denyWrite).toContain(
      join(globalSkillsDirectory, "**", ".env"),
    );
    expect(requestApproval).not.toHaveBeenCalled();
    expect(result.content).toEqual([{ type: "text", text: "allowed" }]);
    expect(result.details.sandboxed).toBe(true);
  });

  it("approves one domain and retries inside the expanded sandbox", async () => {
    const cwd = await temporaryDirectory("willow-domain-policy-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createBashTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("network", { command: "network-attempt" });

    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "network",
        reason: "network-domain",
        display: "example.com",
      }),
      undefined,
    );
    expect(sandbox.configs).toHaveLength(2);
    expect(sandbox.configs[0].network.allowedDomains).toEqual([]);
    expect(sandbox.configs[0].network.strictAllowlist).toBe(false);
    expect(sandbox.configs[1].network.allowedDomains).toEqual(["example.com"]);
    expect(result.content).toEqual([{ type: "text", text: "network allowed" }]);
    expect(result.details.sandboxed).toBe(true);
  });

  it("approves one path and retries inside the expanded sandbox", async () => {
    const cwd = await temporaryDirectory("willow-write-policy-");
    const outside = join(await workspaceTemporaryDirectory(".willow-write-outside-"), "output.txt");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createBashTool({
      cwd,
      permissionMode: "delegate-approval",
      requestApproval,
    }).execute("write", { command: `write-attempt:${outside}` });

    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "write",
        reason: "outside-workspace-write",
        display: outside,
      }),
      undefined,
    );
    expect(sandbox.configs).toHaveLength(2);
    expect(sandbox.configs[1].filesystem.allowWrite).toContain(outside);
    expect(await readFile(outside, "utf8")).toBe("allowed");
    expect(result.details.sandboxed).toBe(true);
  });

  it("approves one read path and retries inside the expanded sandbox", async () => {
    const cwd = await temporaryDirectory("willow-read-policy-");
    const outside = join(await workspaceTemporaryDirectory(".willow-read-outside-"), "input.txt");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createBashTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("read", { command: `read-attempt:${outside}` });

    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "read",
        reason: "outside-workspace-read",
        display: outside,
      }),
      undefined,
    );
    expect(sandbox.configs).toHaveLength(2);
    expect(sandbox.configs[1].filesystem.allowRead).toContain(outside);
    expect(result.content).toEqual([{ type: "text", text: "allowed" }]);
  });

  it("labels writes to user PATH directories as executable installation", async () => {
    const cwd = await temporaryDirectory("willow-executable-policy-");
    const executable = join(homedir(), ".local", "bin", "willow-test-cli");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createBashTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("install", { command: `install-attempt:${executable}` });

    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "executable-install", display: executable }),
      undefined,
    );
    expect(result.content).toEqual([{ type: "text", text: "allowed" }]);
  });

  it("routes process inspection to its dedicated tool and separately approves shell capabilities", async () => {
    const cwd = await temporaryDirectory("willow-capabilities-policy-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

    await expect(
      createBashTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("process", { command: "process-attempt" }),
    ).rejects.toThrow("use the processList tool instead");
    const bindingResult = await createBashTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("binding", { command: "local-binding-attempt" });
    const ptyResult = await createBashTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("pty", { command: "pty-attempt", interactive: true });

    expect(requestApproval.mock.calls.map(([request]) => request.reason)).toEqual([
      "local-network-listen",
      "interactive-terminal",
    ]);
    expect(bindingResult.content).toEqual([{ type: "text", text: "binding allowed" }]);
    expect(ptyResult.content).toEqual([{ type: "text", text: "pty allowed" }]);
    expect(sandbox.configs[2].network.allowLocalBinding).toBe(true);
    expect(sandbox.configs[4].allowPty).toBe(true);
    expect(sandbox.configs[4].allowBrowserProcess).toBe(false);
  });

  it("reports an insufficient write grant separately from a sensitive write", async () => {
    const cwd = await temporaryDirectory("willow-stubborn-write-policy-");
    const outside = join(await workspaceTemporaryDirectory(".willow-stubborn-write-"), "file.txt");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

    await expect(
      createBashTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("stubborn", { command: `stubborn-write:${outside}` }),
    ).rejects.toThrow(`Write grant was insufficient for ${outside} (file-write-create)`);
    expect(requestApproval).toHaveBeenCalledTimes(1);
  });

  it("does not classify an output-only process denial as a write request", async () => {
    const cwd = await temporaryDirectory("willow-output-denial-policy-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

    await expect(
      createBashTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("output-denial", { command: "output-only-process-denial" }),
    ).rejects.toThrow("Command exited with code 1");
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("approves application launch and retries with Apple Events enabled", async () => {
    const cwd = await temporaryDirectory("willow-application-policy-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createBashTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    }).execute("application", { command: "application-attempt" });

    expect(requestApproval).toHaveBeenCalledWith(
      {
        toolCallId: "application",
        toolName: "bash",
        input: { command: "application-attempt" },
        reason: "application-launch",
        display: "application-attempt",
        mayHavePartialEffects: true,
      },
      undefined,
    );
    expect(sandbox.configs).toHaveLength(2);
    expect(sandbox.configs[0].allowAppleEvents).toBe(false);
    expect(sandbox.configs[1].allowAppleEvents).toBe(true);
    expect(sandbox.configs[1].allowBrowserProcess).toBe(false);
    expect(result.content).toEqual([{ type: "text", text: "application allowed" }]);
    expect(result.details.sandboxed).toBe(true);
  });

  it("does not retry a denied or unhandled application launch", async () => {
    const cwd = await temporaryDirectory("willow-application-denied-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");

    await expect(
      createBashTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("denied-application", { command: "application-attempt" }),
    ).rejects.toThrow("Permission denied for bash");
    expect(sandbox.configs).toHaveLength(1);

    sandbox.configs.length = 0;
    await expect(
      createBashTool({
        cwd,
        permissionMode: "delegate-approval",
      }).execute("unhandled-application", { command: "application-attempt" }),
    ).rejects.toThrow("Permission denied for bash");
    expect(sandbox.configs).toHaveLength(1);
  });

  it("does not retry application launch after approval when the sandbox still denies it", async () => {
    const cwd = await temporaryDirectory("willow-application-hard-failure-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

    await expect(
      createBashTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("hard-failure", { command: "application-hard-failure" }),
    ).rejects.toThrow("Command exited with code 1");
    expect(requestApproval).toHaveBeenCalledTimes(1);
    expect(sandbox.configs).toHaveLength(2);
    expect(sandbox.configs[1].allowAppleEvents).toBe(true);
  });

  it("stops before rerunning an application launch when approval is aborted", async () => {
    const cwd = await temporaryDirectory("willow-application-aborted-");
    const controller = new AbortController();
    const requestApproval = vi.fn<ToolApprovalHandler>(async (_request, signal) => {
      controller.abort();
      expect(signal?.aborted).toBe(true);
      return "allow";
    });

    await expect(
      createBashTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("aborted-application", { command: "application-attempt" }, controller.signal),
    ).rejects.toThrow("Operation aborted");
    expect(sandbox.configs).toHaveLength(1);
  });

  it("combines domain, write-path, and application grants for one command", async () => {
    const cwd = await temporaryDirectory("willow-multi-policy-");
    const outside = join(await workspaceTemporaryDirectory(".willow-multi-outside-"), "output.txt");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const result = await createBashTool({
      cwd,
      permissionMode: "delegate-approval",
      requestApproval,
    }).execute("multi", { command: `multi-attempt:${outside}` });

    expect(requestApproval.mock.calls.map(([request]) => request.reason)).toEqual([
      "network-domain",
      "outside-workspace-write",
      "application-launch",
    ]);
    expect(sandbox.configs).toHaveLength(4);
    expect(sandbox.configs[3].network.allowedDomains).toContain("example.com");
    expect(sandbox.configs[3].filesystem.allowWrite).toContain(outside);
    expect(sandbox.configs[3].allowAppleEvents).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "all allowed" }]);
  });

  it("does not offer a generic unsandboxed retry for unknown denials", async () => {
    const cwd = await temporaryDirectory("willow-unknown-denial-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

    await expect(
      createBashTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("unknown", { command: "unknown-attempt" }),
    ).rejects.toThrow("Command exited with code 1");
    expect(requestApproval).not.toHaveBeenCalled();
    expect(sandbox.wrapWithSandbox).toHaveBeenCalledTimes(1);
  });
});
