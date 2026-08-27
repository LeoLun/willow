# Core Package Guidelines

These instructions apply to all work under `packages/core/` and supplement the repository-level
`AGENTS.md`.

## Architecture and Source of Truth

`@willow/core` owns Agent/session construction, prompt/resource loading, and the built-in tool
runtime. The complete permission architecture is documented in
[`../../docs/permission-design.md`](../../docs/permission-design.md).

Before planning or changing tools, permission modes, bash execution, approval contracts, path
authorization, or tool execution details, read that design document in full. Keep it synchronized
with material behavior or public-interface changes.

## Tool Organization

- Each built-in tool must have its own implementation file under `src/tools/`: `bash.ts`,
  `read.ts`, `write.ts`, `edit.ts`, `ls.ts`, `grep.ts`, and `find.ts`.
- Keep registration and public re-exports in `src/tools/index.ts`.
- Put genuinely shared path, authorization, mutation-queue, and search-walking behavior in focused
  support modules such as `shared.ts` and `search-files.ts`. Do not merge multiple tool
  implementations into a single file.
- Export each tool's input type and the shared permission/details types through the package public
  API.
- Preserve strict TypeScript, ESM imports with `.js` suffixes for local runtime imports, and the
  repository formatting rules.

## Permission Contract

The supported public permission modes are:

```ts
type PermissionMode =
  | "request-approval"
  | "delegate-approval"
  | "full-access";
```

Maintain these invariants:

- `request-approval` is the safe default when no mode is supplied.
- The Work App owns the session-level permission mode. Core captures it once when each tool call
  starts permission evaluation and uses that snapshot for both routing and execution.
- An approval applies only to one `toolCallId`. Do not introduce permanent or implicit approval
  rules without an explicit design change.
- Every built-in tool goes through `ToolBase`, `ApprovalAction` normalization, and the Harness-local
  `PermissionEngine`. An unregistered tool policy must fail closed.
- `ALLOW`, `REVIEW`, and `DENY` are action decisions. Modes only route `REVIEW`; `full-access`
  cannot override `DENY`.
- In either non-full-access mode, a missing approval callback must safely deny any required escape.
- `delegate-approval` may use AI review only when `autoReviewable !== false`; elevated Bash is
  always human-only.
- Create one `PermissionEngine`, `EscalationStore`, and optional event sink per Harness.

## Tool Authorization Boundaries

### `bash`

- Always run the deterministic Bash policy before spawning. Hard-denied commands must never spawn,
  including in `full-access`.
- Non-full-access calls run through the pinned sandbox runtime in `workspace-write`; runtime setup,
  wrap, or reset failure is `SANDBOX_UNAVAILABLE` and must never fall back to a bare shell.
- Serialize the process-global sandbox Manager lifecycle with the shared asynchronous mutex.
- Sandbox denial returns a bound one-time token. Elevated retries require the exact command,
  canonical cwd, token, and justification, and are never auto-reviewable.
- Remove common secrets and credentials from inherited shell environments.
- Abort and timeout must terminate the spawned process group.
- Stream combined stdout/stderr updates. Return at most the last 2000 lines or 50KB and retain the
  complete output in a temporary log when truncated.

Any change that weakens process termination or changes how `bash` is spawned is
security-sensitive and requires corresponding tests and documentation updates.

### `write` and `edit`

- Authorize the target before creating directories, reading for edit, or writing.
- Resolve relative paths from the workspace and compare canonical paths.
- Resolve the nearest existing parent so nonexistent targets cannot evade checks.
- Treat workspace symlinks pointing outside the workspace as outside-workspace writes.
- Allow workspace-contained and global-skills-contained writes without prompting.
- Sensitive files, Git hooks/config, and shell startup files are hard-denied in every mode.
- Serialize mutations to the same resolved absolute path within the process.
- `edit` must use unique, nonempty, non-overlapping exact replacements and preserve UTF-8 BOM and
  the original newline style. Return a unified diff and added/removed line counts.

### Read-only tools

`read`, `ls`, `grep`, and `find` must authorize their target or search root before reading.
Workspace paths, the global skills directory derived from `agentDir`, and
explicitly configured `allowRead`/`allowWrite` roots are allowed; other paths require one-call
approval. Canonicalize paths so symlink escapes cannot bypass the boundary.

Credential directories, `.env*`, PEM files, and key files are hard-denied in every mode.

- `read` supports 1-indexed offsets and line limits, with the common 2000-line/50KB bound.
- `ls` lists only direct children in deterministic order.
- `grep` and `find` respect `.gitignore`, skip `.git` and `node_modules` by default, and allow an
  explicitly selected skipped directory as the search root.
- `grep` skips binary files containing NUL bytes.
- Search limits, structured details, truncation metadata, and AbortSignal handling are public
  behavior and must remain deterministic.

## Approval and Error Semantics

- Include the normalized Action, risk, rule ID, structured reason, `autoReviewable`, minimal scope,
  original input, tool name, call ID, and display text in every approval request.
- A denial must fail the current tool call without granting later calls.
- Propagate AbortSignal through tool execution and approval waiting.
- Reject invalid numeric parameters such as non-positive limits/timeouts before execution.
- Return structured tool details needed by the Work App summaries: paths, actual line counts,
  match/result counts, exit code, truncation metadata, and edit diff statistics.
- Do not expose a successful result when a shell command exits nonzero or an operation was aborted.

## Testing Requirements

Core tests belong in `test/*.test.ts` and run with:

```sh
pnpm --filter @willow/core test
```

For tool or permission changes, cover the affected branches, including as applicable:

- all three permission modes;
- permission policy coverage for every built-in tool, hard-deny priority, and fail-closed unknowns;
- Bash analysis, sandbox execution, escalation, output, nonzero exit, timeout, abort, and truncation;
- missing approval callbacks and abort cleanup;
- workspace, outside-workspace, nonexistent, and symlink-escape paths;
- argument validation, truncation, binary skipping, `.gitignore`, and deterministic limits;
- exact-edit failures, BOM/newline preservation, diff and line statistics;
- real platform sandbox smoke and child-process escape attacks where supported.

Also run repository typechecking and linting for public API or cross-package changes.
