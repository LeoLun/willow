import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const sandbox = vi.hoisted(() => {
  let config: {
    network: { allowedDomains: string[] };
    filesystem: { allowRead: string[]; allowWrite: string[]; denyWrite: string[] };
  };
  let ask: ((input: { host: string; port?: number }) => Promise<boolean>) | undefined;
  const configs: (typeof config)[] = [];
  return {
    configs,
    initialize: vi.fn(async (nextConfig, nextAsk) => {
      config = nextConfig;
      ask = nextAsk;
      configs.push(structuredClone(nextConfig));
    }),
    wrapWithSandbox: vi.fn(async (command: string) => {
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
      return "printf 'Operation not permitted' >&2; exit 1";
    }),
    cleanupAfterCommand: vi.fn(),
    reset: vi.fn(async () => undefined),
    violationStore: {
      clear: vi.fn(),
      getViolationsForCommand: vi.fn(() => []),
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
