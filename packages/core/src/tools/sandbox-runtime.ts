import { realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import {
  SandboxManager,
  type SandboxRuntimeConfig,
  type SandboxViolationEvent,
} from "@carderne/sandbox-runtime";
import { sandboxDenyWritePatterns, sandboxPolicyPaths } from "./policy.js";
import type { SandboxPolicy } from "./types.js";

let sandboxRuntimeTail: Promise<void> = Promise.resolve();

export type SandboxGrants = {
  readPaths: string[];
  writePaths: string[];
  domains: string[];
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
): SandboxRuntimeConfig {
  return {
    network: {
      allowedDomains: unique([...(policy?.allowedDomains ?? []), ...grants.domains]),
      deniedDomains: unique(policy?.deniedDomains ?? []),
      strictAllowlist: true,
      allowLocalBinding: false,
      allowUnauthenticatedSocksProxy: false,
    },
    filesystem: {
      denyRead: [canonicalDirectory(homedir())],
      allowRead: unique([
        canonicalDirectory(cwd),
        canonicalDirectory(tmpdir()),
        ...sandboxPolicyPaths(cwd, policy?.allowRead),
        ...grants.readPaths,
      ]),
      allowWrite: unique([
        canonicalDirectory(cwd),
        canonicalDirectory(tmpdir()),
        ...sandboxPolicyPaths(cwd, policy?.allowWrite),
        ...grants.writePaths,
      ]),
      denyWrite: sandboxDenyWritePatterns(cwd, policy),
    },
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
    allowAppleEvents: false,
    allowBrowserProcess: false,
  };
}

export async function withPreparedSandbox<T>(
  options: {
    cwd: string;
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
      createSandboxRuntimeConfig(options.cwd, options.policy, options.grants),
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
