import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import {
  SandboxManager,
  type SandboxRuntimeConfig,
  type SandboxViolationEvent,
} from "@carderne/sandbox-runtime";
import {
  resolveGlobalSkillsDirectory,
  sandboxDenyWritePatterns,
  sandboxPolicyPaths,
} from "./policy.js";
import { systemTemporaryDirectories } from "./temporary-directories.js";
import type { SandboxPolicy } from "./types.js";

let sandboxRuntimeTail: Promise<void> = Promise.resolve();

export type SandboxGrants = {
  readPaths: string[];
  writePaths: string[];
  domains: string[];
  allowAppleEvents: boolean;
  allowLocalBinding: boolean;
  allowPty: boolean;
};

export type PreparedSandboxCommand = {
  command: string;
  deniedDomains: string[];
  getViolations: () => SandboxViolationEvent[];
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function canonicalDirectory(path: string): string {
  return realpathSync(path);
}

export function createSandboxRuntimeConfig(
  cwd: string,
  policy: SandboxPolicy | undefined,
  grants: SandboxGrants,
  agentDir?: string,
): SandboxRuntimeConfig {
  const canonicalHome = canonicalDirectory(homedir());
  const globalSkillsDirectory = resolveGlobalSkillsDirectory(agentDir);
  const temporaryDirectories = systemTemporaryDirectories();

  return {
    network: {
      allowedDomains: unique([...(policy?.allowedDomains ?? []), ...grants.domains]),
      deniedDomains: unique(policy?.deniedDomains ?? []),
      // The callback records unknown hosts while still rejecting the first attempt.
      // Strict mode would skip that callback, so Willow could not request approval.
      strictAllowlist: false,
      allowLocalBinding: grants.allowLocalBinding,
      allowUnauthenticatedSocksProxy: false,
    },
    filesystem: {
      denyRead: [canonicalHome],
      allowRead: unique([
        canonicalDirectory(cwd),
        ...temporaryDirectories,
        ...(globalSkillsDirectory ? [globalSkillsDirectory] : []),
        ...sandboxPolicyPaths(cwd, policy?.allowRead),
        ...sandboxPolicyPaths(cwd, policy?.allowWrite),
        ...grants.readPaths,
        ...grants.writePaths,
      ]),
      allowWrite: unique([
        canonicalDirectory(cwd),
        ...temporaryDirectories,
        ...(globalSkillsDirectory ? [globalSkillsDirectory] : []),
        ...sandboxPolicyPaths(cwd, policy?.allowWrite),
        ...grants.writePaths,
      ]),
      denyWrite: sandboxDenyWritePatterns(
        cwd,
        policy,
        globalSkillsDirectory ? [globalSkillsDirectory] : [],
      ),
    },
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
    allowAppleEvents: grants.allowAppleEvents,
    allowPty: grants.allowPty,
    allowBrowserProcess: false,
  };
}

export async function withPreparedSandbox<T>(
  options: {
    cwd: string;
    agentDir?: string;
    command: string;
    policy?: SandboxPolicy;
    grants: SandboxGrants;
    signal?: AbortSignal;
  },
  operation: (prepared: PreparedSandboxCommand) => Promise<T>,
): Promise<T> {
  const previous = sandboxRuntimeTail;
  let release!: () => void;
  sandboxRuntimeTail = new Promise<void>((resolvePromise) => {
    release = resolvePromise;
  });
  await previous;

  const deniedDomains: string[] = [];
  const violationStore = SandboxManager.getSandboxViolationStore();
  violationStore.clear();
  try {
    await SandboxManager.initialize(
      createSandboxRuntimeConfig(options.cwd, options.policy, options.grants, options.agentDir),
      async ({ host }) => {
        deniedDomains.push(host);
        return false;
      },
      true,
    );
    const command = await SandboxManager.wrapWithSandbox(
      options.command,
      "/bin/bash",
      undefined,
      options.signal,
    );
    return await operation({
      command,
      deniedDomains,
      getViolations: () => violationStore.getViolationsForCommand(options.command),
    });
  } finally {
    SandboxManager.cleanupAfterCommand();
    await SandboxManager.reset();
    release();
  }
}
