import type { ToolPermissionDecision } from "./create-tool";

const HIGH_RISK_PATTERNS = [
  /\brm\b/i,
  /\bsudo\b/i,
  /\bmkfs(?:\.[a-z0-9]+)?\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bhalt\b/i,
  /\bchown\s+-R\b/i,
  /\bchmod\s+-R\s+777\b/i,
  /\bmv\b.+\s+\/(?:[^/\s]+)?$/i,
];

export function classifyBashCommand(command: string): ToolPermissionDecision {
  const normalized = command.trim();
  if (normalized.length === 0) {
    return { mode: "allow" };
  }

  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      mode: "ask",
      reason: "检测到高危 shell 操作，需要人工确认",
      risk: "high",
    };
  }

  return { mode: "allow" };
}
