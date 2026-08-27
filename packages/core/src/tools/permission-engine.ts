import { homedir } from "node:os";
import { basename, join } from "node:path";
import minimatch from "minimatch";
import { isExpectedToolPath } from "./directory-access.js";
import { canonicalMutationPath, isPathInside } from "./policy.js";
import type {
  ApprovalAction,
  PermissionDecision,
  PermissionEngine,
  PermissionPolicy,
  ToolName,
  ToolPermissionContext,
  ToolRuntimeOptions,
} from "./types.js";

const READ_TOOLS = new Set<ToolName>(["read", "ls", "grep", "find"]);
const WRITE_TOOLS = new Set<ToolName>(["write", "edit"]);
const INTERNAL_TOOLS = new Set<ToolName>([
  "todoList",
  "askUser",
  "listAutomations",
  "writePlan",
  "updatePlan",
]);

const SAFE_SIMPLE_COMMANDS = new Set([
  "pwd",
  "ls",
  "find",
  "cat",
  "head",
  "tail",
  "grep",
  "rg",
  "sed",
  "wc",
  "stat",
]);

const REVIEW_PATTERNS = [
  /(?:^|\s)(?:npm|pnpm|yarn)\s+(?:install|add|remove|publish|update)\b/i,
  /(?:^|\s)git\s+(?:add|branch\s+(?!--(?:list|show-current|contains|merged|no-merged)\b)|commit|tag|push|reset|checkout|clean|config|merge|rebase|cherry-pick|revert|restore|switch|stash)\b/i,
  /(?:^|\s)(?:rm|mv|cp|chmod|chown|kill|pkill|docker|brew|apt|apt-get|yum|dnf|ssh|scp|rsync|open|osascript)\b/i,
  /(?:curl|wget)[^|\n]*\|\s*(?:sh|bash)\b/i,
] as const;

const HARD_DENY_PATTERNS = [
  /(?:^|[;&|]\s*)sudo\b/i,
  /\brm\s+(?:-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\s+(?:\/|\/\*|~)(?:\s|$)/i,
  /(?:^|\s)(?:mkfs(?:\.\w+)?|fdisk|parted|shutdown|reboot|halt|poweroff)\b/i,
  /:\(\)\s*\{\s*:\|:&\s*;\s*\}\s*;\s*:/,
] as const;

const SENSITIVE_BASENAMES = [".env", ".env.*", "*.pem", "*.key", ".netrc", ".npmrc"] as const;
const SENSITIVE_HOME_ROOTS = [
  ".ssh",
  ".aws",
  ".azure",
  ".gnupg",
  ".kube",
  ".config/gcloud",
] as const;
const SHELL_RC_FILES = [".bashrc", ".zshrc", ".profile", ".zprofile"] as const;

export type CommandFacts = {
  commands: string[];
  hasPipe: boolean;
  hasRedirect: boolean;
  hasCommandSubstitution: boolean;
  hasSudo: boolean;
  destructive: boolean;
  sensitive: boolean;
  packageInstall: boolean;
  gitWrite: boolean;
};

export function analyzeCommand(command: string): CommandFacts {
  const commands = command
    .split(/(?:&&|\|\||(?<!\|)\|(?!\|)|;|\n)/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    commands,
    hasPipe: /(^|[^|])\|([^|]|$)/.test(command),
    hasRedirect: /(?:^|\s)(?:>>?|<<?)\s*\S/.test(command),
    hasCommandSubstitution: /\$\(|`/.test(command),
    hasSudo: /(?:^|\s)sudo\b/.test(command),
    destructive: /(?:^|\s)(?:rm|mkfs|fdisk|parted|shutdown|reboot|halt|poweroff)\b/i.test(command),
    sensitive: commandReferencesSensitiveResource(command),
    packageInstall: /(?:^|\s)(?:npm|pnpm|yarn)\s+(?:install|add|remove|publish|update)\b/i.test(
      command,
    ),
    gitWrite:
      /(?:^|\s)git\s+(?:add|branch\s+(?!--(?:list|show-current|contains|merged|no-merged)\b)|commit|tag|push|reset|checkout|clean|config|merge|rebase|cherry-pick|revert|restore|switch|stash)\b/i.test(
        command,
      ),
  };
}

function commandReferencesSensitiveResource(command: string): boolean {
  return (
    /(?:^|[\s"'])(?:~|\$HOME|\/root|\/Users\/[^/\s]+|\/home\/[^/\s]+)\/(?:\.ssh|\.aws|\.azure|\.gnupg|\.kube|\.config\/gcloud)(?:\/|[\s"']|$)/i.test(
      command,
    ) ||
    /(?:^|[\s/"'])(?:\.env(?:\.[^\s/"']*)?|\.netrc|\.npmrc|[^\s/"']+\.(?:pem|key))(?:[\s"']|$)/i.test(
      command,
    ) ||
    /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN)\b/.test(
      command,
    )
  );
}

function decision(
  action: PermissionDecision["action"],
  risk: PermissionDecision["risk"],
  ruleId: string,
  message: string,
  autoReviewable?: boolean,
): PermissionDecision {
  return {
    action,
    risk,
    ruleId,
    reason: { type: ruleId, message },
    autoReviewable,
  };
}

async function isSensitivePath(cwd: string, inputPath: string, operation: "read" | "write") {
  const path = await canonicalMutationPath(cwd, inputPath);
  const home = await canonicalMutationPath(cwd, homedir());
  for (const root of SENSITIVE_HOME_ROOTS) {
    const sensitiveRoot = await canonicalMutationPath(cwd, join(home, root));
    if (isPathInside(sensitiveRoot, path)) return true;
  }
  if (SENSITIVE_BASENAMES.some((pattern) => minimatch(basename(path), pattern, { dot: true }))) {
    return true;
  }
  if (operation === "write") {
    if (SHELL_RC_FILES.includes(basename(path) as (typeof SHELL_RC_FILES)[number])) return true;
    if (/(?:^|\/)\.git\/(?:hooks(?:\/|$)|config$)/.test(path)) return true;
  }
  return false;
}

class FilePermissionPolicy implements PermissionPolicy {
  supports(context: ToolPermissionContext): boolean {
    return READ_TOOLS.has(context.toolName) || WRITE_TOOLS.has(context.toolName);
  }

  async evaluate(context: ToolPermissionContext): Promise<PermissionDecision> {
    if (context.action.type !== "filesystem") {
      return decision("deny", "high", "filesystem.invalid-action", "Invalid filesystem action.");
    }
    const operation = context.action.operation;
    const path = context.action.paths[0];
    if (!path) return decision("deny", "high", "filesystem.missing-path", "Missing target path.");
    if (await isSensitivePath(context.workspaceRoot, path, operation)) {
      return decision(
        "deny",
        "critical",
        `filesystem.sensitive-${operation}`,
        `Sensitive ${operation} denied for ${path}`,
      );
    }
    const allowed = await isExpectedToolPath({
      cwd: context.workspaceRoot,
      path,
      access: operation,
      agentDir: context.agentDir,
      sandboxPolicy: context.sandboxPolicy,
    });
    return allowed
      ? decision(
          "allow",
          "low",
          `filesystem.allowed-${operation}`,
          `${operation} is within an authorized root.`,
        )
      : decision(
          "review",
          operation === "read" ? "medium" : "high",
          `filesystem.outside-workspace-${operation}`,
          `${operation} target is outside authorized roots: ${path}`,
          true,
        );
  }
}

class BashPermissionPolicy implements PermissionPolicy {
  supports(context: ToolPermissionContext): boolean {
    return context.toolName === "bash";
  }

  async evaluate(context: ToolPermissionContext): Promise<PermissionDecision> {
    if (context.action.type !== "exec") {
      return decision("deny", "high", "bash.invalid-action", "Invalid exec action.");
    }
    const { command, interactive, sandboxPermissions } = context.action;
    const facts = analyzeCommand(command);
    if (
      HARD_DENY_PATTERNS.some((pattern) => pattern.test(command)) ||
      facts.hasSudo ||
      facts.sensitive
    ) {
      return decision("deny", "critical", "bash.hard-deny", "Command matches a hard deny rule.");
    }
    if (sandboxPermissions === "elevated") {
      return decision(
        "review",
        "high",
        "bash.sandbox-escalation",
        "One-time execution outside workspace-write sandbox requested.",
        false,
      );
    }
    if (interactive) {
      return decision(
        "review",
        "high",
        "bash.interactive-terminal",
        "Interactive terminal capability requires approval.",
        false,
      );
    }
    if (REVIEW_PATTERNS.some((pattern) => pattern.test(command))) {
      return decision(
        "review",
        "high",
        "bash.risky-command",
        "Command has elevated side effects.",
        true,
      );
    }
    const safeSegments = facts.commands.every(isKnownSafeCommand);
    if (safeSegments && !facts.hasRedirect && !facts.hasCommandSubstitution) {
      return decision("allow", "low", "bash.known-safe", "Command is in the built-in safe set.");
    }
    return decision(
      "review",
      facts.hasPipe || facts.hasRedirect || facts.hasCommandSubstitution ? "high" : "medium",
      "bash.unclassified",
      "Command cannot be safely classified by deterministic rules.",
      true,
    );
  }
}

function isKnownSafeCommand(segment: string): boolean {
  const [executable] = segment.split(/\s+/, 1);
  if (executable && SAFE_SIMPLE_COMMANDS.has(executable)) {
    if (executable === "find" && /(?:^|\s)-(?:delete|exec|execdir|ok)\b/.test(segment)) {
      return false;
    }
    if (executable === "sed" && /(?:^|\s)-(?:[^\s]*i[^\s]*)\b/.test(segment)) return false;
    return true;
  }
  if (/^git\s+(?:status|diff|log|show)(?:\s|$)/.test(segment)) return true;
  if (
    /^git\s+branch(?:\s+(?:--(?:list|show-current|contains|merged|no-merged)|-[arv]+)(?:\s+[^\s]+)*)?$/.test(
      segment,
    )
  ) {
    return true;
  }
  return /^(?:npm|pnpm|yarn)(?:\s+--filter\s+\S+)*\s+(?:test|lint|build|typecheck|format:check|run\s+(?:test|lint|build|typecheck|format:check))(?:\s|$)/.test(
    segment,
  );
}

class AutomationPermissionPolicy implements PermissionPolicy {
  supports(context: ToolPermissionContext): boolean {
    return ["createAutomation", "updateAutomation", "deleteAutomation"].includes(context.toolName);
  }

  async evaluate(context: ToolPermissionContext): Promise<PermissionDecision> {
    return decision(
      "review",
      context.toolName === "deleteAutomation" ? "high" : "medium",
      `automation.${context.toolName}`,
      "Persistent automation changes require one-call approval.",
      true,
    );
  }
}

class NetworkPermissionPolicy implements PermissionPolicy {
  supports(context: ToolPermissionContext): boolean {
    return context.toolName === "webfetch" || context.toolName === "websearch";
  }

  async evaluate(context: ToolPermissionContext): Promise<PermissionDecision> {
    if (context.action.type !== "network") {
      return decision("deny", "high", "network.invalid-action", "Invalid network action.");
    }
    let hostname: string;
    try {
      hostname = new URL(context.action.url).hostname.toLowerCase().replace(/\.$/, "");
    } catch {
      return decision("deny", "high", "network.invalid-url", "Invalid network URL.");
    }
    const deniedDomains = new Set(
      (context.sandboxPolicy?.deniedDomains ?? [])
        .map((domain) => domain.trim().toLowerCase().replace(/\.$/, ""))
        .filter(Boolean),
    );
    if (deniedDomains.has(hostname)) {
      return decision(
        "deny",
        "high",
        "network.denied-domain",
        `Network domain is denied by policy: ${hostname}`,
      );
    }
    return decision(
      "allow",
      "low",
      "network.default-allow",
      "Network access is allowed by policy.",
    );
  }
}

class InternalPermissionPolicy implements PermissionPolicy {
  supports(context: ToolPermissionContext): boolean {
    return INTERNAL_TOOLS.has(context.toolName);
  }

  async evaluate(): Promise<PermissionDecision> {
    return decision(
      "allow",
      "low",
      "internal.allowed",
      "Internal capability is explicitly allowed.",
    );
  }
}

export class DefaultPermissionEngine implements PermissionEngine {
  constructor(
    private readonly policies: PermissionPolicy[] = [
      new BashPermissionPolicy(),
      new FilePermissionPolicy(),
      new AutomationPermissionPolicy(),
      new NetworkPermissionPolicy(),
      new InternalPermissionPolicy(),
    ],
  ) {}

  async evaluate(context: ToolPermissionContext): Promise<PermissionDecision> {
    const policy = this.policies.find((candidate) => candidate.supports(context));
    if (!policy) {
      return decision(
        "deny",
        "high",
        "tool.unregistered-policy",
        `No permission policy is registered for ${context.toolName}.`,
      );
    }
    const result = await policy.evaluate(context);
    if (result.action === "review" && result.requestedPermissions === undefined) {
      result.requestedPermissions = requestedPermissions(context.action);
    }
    return result;
  }
}

function requestedPermissions(action: ApprovalAction): Record<string, unknown> {
  switch (action.type) {
    case "exec":
      return {
        capability: action.sandboxPermissions === "elevated" ? "full-access-once" : "exec-once",
        command: action.command,
        cwd: action.cwd,
      };
    case "filesystem":
      return { capability: `${action.operation}-once`, paths: action.paths };
    case "network":
      return { capability: "network-once", url: action.url, method: action.method };
    case "automation":
      return { capability: `automation-${action.operation}-once` };
    case "internal":
      return { capability: action.capability };
  }
}

export function normalizeApprovalAction(
  toolName: ToolName,
  input: Record<string, unknown>,
  options: Pick<ToolRuntimeOptions, "cwd">,
): ApprovalAction {
  if (toolName === "bash") {
    return {
      type: "exec",
      command: typeof input.command === "string" ? input.command : "",
      cwd: options.cwd,
      interactive: input.interactive === true,
      sandboxPermissions: input.sandboxPermissions === "elevated" ? "elevated" : "default",
      justification: typeof input.justification === "string" ? input.justification : undefined,
      escalationToken:
        typeof input.escalationToken === "string" ? input.escalationToken : undefined,
    };
  }
  if (READ_TOOLS.has(toolName) || WRITE_TOOLS.has(toolName)) {
    return {
      type: "filesystem",
      operation: WRITE_TOOLS.has(toolName) ? "write" : "read",
      paths: [typeof input.path === "string" && input.path ? input.path : "."],
      cwd: options.cwd,
    };
  }
  if (toolName === "webfetch") {
    return { type: "network", url: String(input.url ?? ""), method: "GET" };
  }
  if (toolName === "websearch") {
    return { type: "network", url: "https://api.tavily.com/search", method: "POST" };
  }
  if (
    toolName === "createAutomation" ||
    toolName === "updateAutomation" ||
    toolName === "deleteAutomation"
  ) {
    return {
      type: "automation",
      operation:
        toolName === "createAutomation"
          ? "create"
          : toolName === "updateAutomation"
            ? "update"
            : "delete",
      input,
    };
  }
  if (toolName === "listAutomations") {
    return { type: "automation", operation: "list", input };
  }
  return { type: "internal", capability: toolName };
}
