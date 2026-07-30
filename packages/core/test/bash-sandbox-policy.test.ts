import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const sandbox = vi.hoisted(() => {
  let config: {
    network: { allowedDomains: string[] };
    filesystem: { allowRead: string[]; allowWrite: string[]; denyWrite: string[] };
    allowAppleEvents: boolean;
    allowBrowserProcess: boolean;
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
          await ask?.({ host: "example.com", port: 443 });
          return "printf 'network denied' >&2; exit 1";
        }
        return "printf 'network allowed'";
      }
      if (command.startsWith("write-attempt:")) {
        const path = command.slice("write-attempt:".length);
        if (!config.filesystem.allowWrite.includes(path)) {
          return `printf 'bash: ${path}: Operation not permitted\\n' >&2; exit 1`;
        }
        return `printf 'allowed' > ${JSON.stringify(path)}`;
      }
      if (command.startsWith("read-attempt:")) {
        const path = command.slice("read-attempt:".length);
        return config.filesystem.allowRead.includes(path)
          ? "printf 'allowed'"
          : `printf 'bash: ${path}: Operation not permitted\\n' >&2; exit 1`;
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
      if (command.startsWith("multi-attempt:")) {
        const path = command.slice("multi-attempt:".length);
        if (!config.network.allowedDomains.includes("example.com")) {
          await ask?.({ host: "example.com", port: 443 });
          return "printf 'network denied' >&2; exit 1";
        }
        if (!config.filesystem.allowWrite.includes(path)) {
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
