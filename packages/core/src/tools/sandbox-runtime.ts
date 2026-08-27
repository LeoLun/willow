import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  SandboxManager,
  type SandboxRuntimeConfig,
  type SandboxViolationEvent,
} from "@anthropic-ai/sandbox-runtime";
import { resolveGlobalSkillsDirectory, sandboxPolicyPaths } from "./policy.js";
import { systemTemporaryDirectories } from "./temporary-directories.js";
import type { SandboxPolicy, SandboxViolation } from "./types.js";

let sandboxTail: Promise<void> = Promise.resolve();

export type PreparedSandboxCommand = {
  command: string;
  violations: () => SandboxViolation[];
};

function unique(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}

export async function buildSandboxConfig(options: {
  cwd: string;
  agentDir?: string;
  policy?: SandboxPolicy;
  allowPty?: boolean;
}): Promise<SandboxRuntimeConfig> {
  const workspace = await realpath(options.cwd);
  const home = homedir();
  const skills = resolveGlobalSkillsDirectory(options.agentDir);
  const writeRoots = unique([
    workspace,
    ...systemTemporaryDirectories(),
    ...(skills ? [skills] : []),
    ...sandboxPolicyPaths(options.cwd, options.policy?.allowWrite),
  ]);
  const readRoots = unique([
    workspace,
    ...systemTemporaryDirectories(),
    "/etc/ssl/cert.pem",
    "/private/etc/ssl/cert.pem",
    "/etc/ssl/certs",
    ...(skills ? [skills] : []),
    ...sandboxPolicyPaths(options.cwd, options.policy?.allowRead),
    ...writeRoots,
  ]);
  const sensitiveGlobs =
    process.platform === "darwin"
      ? ["/**/.env", "/**/.env.*", "/**/*.pem", "/**/*.key", "/**/.netrc", "/**/.npmrc"]
      : readRoots.flatMap((root) => [
          join(root, "**/.env"),
          join(root, "**/.env.*"),
          join(root, "**/*.pem"),
          join(root, "**/*.key"),
          join(root, "**/.netrc"),
          join(root, "**/.npmrc"),
        ]);
  return {
    network: {
      allowedDomains: [],
      deniedDomains: options.policy?.deniedDomains ?? [],
      strictAllowlist: false,
      allowUnixSockets: [],
      allowAllUnixSockets: false,
      allowLocalBinding: false,
    },
    filesystem: {
      denyRead: [
        join(home, ".ssh"),
        join(home, ".aws"),
        join(home, ".azure"),
        join(home, ".gnupg"),
        join(home, ".kube"),
        join(home, ".config/gcloud"),
        join(home, ".docker/config.json"),
        ...sensitiveGlobs,
      ],
      allowRead: readRoots,
      allowWrite: writeRoots,
      denyWrite: [
        ...sensitiveGlobs,
        "**/.git/hooks",
        "**/.git/hooks/**",
        "**/.git/config",
        join(home, ".bashrc"),
        join(home, ".zshrc"),
        join(home, ".profile"),
        join(home, ".zprofile"),
        ...sandboxPolicyPaths(options.cwd, options.policy?.denyWrite),
      ],
      allowGitConfig: false,
    },
    allowAppleEvents: false,
    allowPty: options.allowPty ?? false,
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
  };
}

export async function withPreparedSandbox<T>(
  options: {
    cwd: string;
    agentDir?: string;
    command: string;
    commandId: string;
    policy?: SandboxPolicy;
    signal?: AbortSignal;
    allowPty?: boolean;
  },
  operation: (prepared: PreparedSandboxCommand) => Promise<T>,
): Promise<T> {
  const previous = sandboxTail;
  let release!: () => void;
  sandboxTail = new Promise<void>((resolvePromise) => {
    release = resolvePromise;
  });
  await previous;
  if (options.signal?.aborted) throw new Error("Operation aborted");

  try {
    if (!SandboxManager.isSupportedPlatform()) {
      throw new Error(`Sandbox is unavailable on platform ${process.platform}`);
    }
    const dependencies = await SandboxManager.checkDependenciesAsync();
    if (dependencies.errors.length > 0) {
      throw new Error(`Sandbox dependencies unavailable: ${dependencies.errors.join("; ")}`);
    }
    const config = await buildSandboxConfig(options);
    const store = SandboxManager.getSandboxViolationStore();
    store.clear();
    await SandboxManager.initialize(config, async () => true, true);
    const command = await SandboxManager.wrapWithSandbox(
      options.command,
      "/bin/bash",
      undefined,
      options.signal,
      { commandId: options.commandId, commandText: options.command },
    );
    return await operation({
      command,
      violations: () =>
        store.getViolationsForCommand(options.commandId).map(classifySandboxViolation),
    });
  } finally {
    try {
      SandboxManager.cleanupAfterCommand();
      await SandboxManager.reset();
    } finally {
      release();
    }
  }
}

function classifySandboxViolation(event: SandboxViolationEvent): SandboxViolation {
  const filesystem = event.line.match(
    /deny(?:\(\d+\))?\s+(file-(?:read|write)[^\s]*)\s+(?:"([^"]+)"|([^\s]+))/i,
  );
  if (filesystem) {
    return {
      type: filesystem[1].toLowerCase().includes("write") ? "filesystem-write" : "filesystem-read",
      path: filesystem[2] ?? filesystem[3],
      message: event.line,
    };
  }
  const network = event.line.match(/deny\s+(?:network-outbound|http-request)\s+([^\s]+)/i);
  if (network) return { type: "network", host: network[1], message: event.line };
  if (/process|sysctl|mach-/i.test(event.line)) {
    return { type: "process", message: event.line };
  }
  return { type: "unknown", message: event.line };
}
