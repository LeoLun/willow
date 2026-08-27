import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { SandboxViolation } from "./types.js";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type EscalationRecord = {
  id: string;
  sessionId: string;
  fingerprint: string;
  violations: SandboxViolation[];
  expiresAt: number;
};

export class EscalationStore {
  private readonly records = new Map<string, EscalationRecord>();

  constructor(
    private readonly sessionId: string,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  create(command: string, cwd: string, violations: SandboxViolation[]): string {
    this.prune();
    const id = randomUUID();
    this.records.set(id, {
      id,
      sessionId: this.sessionId,
      fingerprint: fingerprint(command, cwd),
      violations,
      expiresAt: Date.now() + this.ttlMs,
    });
    return id;
  }

  restore(id: string, command: string, cwd: string, violations: SandboxViolation[]): void {
    this.prune();
    this.records.set(id, {
      id,
      sessionId: this.sessionId,
      fingerprint: fingerprint(command, cwd),
      violations,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  validate(id: string | undefined, command: string, cwd: string): SandboxViolation[] | undefined {
    this.prune();
    if (!id) return undefined;
    const record = this.records.get(id);
    if (
      !record ||
      record.sessionId !== this.sessionId ||
      record.fingerprint !== fingerprint(command, cwd)
    ) {
      return undefined;
    }
    return record.violations;
  }

  consume(id: string): void {
    this.records.delete(id);
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, record] of this.records) {
      if (record.expiresAt <= now) this.records.delete(id);
    }
  }
}

function fingerprint(command: string, cwd: string): string {
  let canonicalCwd: string;
  try {
    canonicalCwd = realpathSync(cwd);
  } catch {
    canonicalCwd = resolve(cwd);
  }
  return createHash("sha256").update(`${canonicalCwd}\0${command}`).digest("hex");
}
