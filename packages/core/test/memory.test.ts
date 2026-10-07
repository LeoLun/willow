import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorizeMemoryPath,
  createDefaultMemory,
  ensureMemoryFile,
  getMemoryPath,
  getMemoryPrompt,
  parseMemoryDocument,
  readMemory,
  saveMemory,
  setMemoryEnabled,
  resolveMemoryConfig,
  serializeMemoryDocument,
  updateMemory,
  type MemoryOptions,
} from "../src/memory/index.js";
import { createWillowTools } from "../src/tools/index.js";
import { MemoryUpdateTool } from "../src/tools/memory-update.js";
import {
  DefaultPermissionEngine,
  normalizeApprovalAction,
} from "../src/tools/permission-engine.js";

const state = vi.hoisted(() => ({ home: "" }));
vi.mock("node:os", async (original) => {
  const os = await original<typeof import("node:os")>();
  return { ...os, homedir: () => state.home || os.homedir() };
});
vi.mock("../src/tools/temporary-directories.js", () => ({ systemTemporaryDirectories: () => [] }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return { ...fs, rename: vi.fn(fs.rename) };
});

let root: string;
let options: MemoryOptions;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "willow-memory-"));
  state.home = join(root, "home");
  options = { cwd: join(root, "project"), projectTrusted: true };
  await Promise.all([mkdir(state.home), mkdir(options.cwd)]);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  state.home = "";
});

async function put(scope: "global" | "project", content: string, config = false) {
  const path = getMemoryPath(options, scope, config);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content);
  return path;
}

function input(newText: string, oldText?: string) {
  return { scope: "project" as const, section: "Conventions", newText, oldText };
}

describe("memory Markdown", () => {
  it("preserves preamble, body, order, third-level headings and fenced headings", () => {
    const text =
      "# Memory\n\nIntro\n\n## User\n\n- preference\n### Detail\ntext\n```md\n## Example\n```\n~~~\n## Another example\n~~~\n\n## Agent\n\n- rule\n";
    const parsed = parseMemoryDocument(text);
    expect(parsed.sections.map((section) => section.name)).toEqual(["User", "Agent"]);
    expect(serializeMemoryDocument(parsed)).toBe(text);
    expect(serializeMemoryDocument(parseMemoryDocument(text.replace(/\n/g, "\r\n")))).toBe(
      text.replace(/\n/g, "\r\n"),
    );
  });
  it.each(["## User\nfirst\n## User\nsecond", "## User\n```\nunclosed", "## User\n\0"])(
    "rejects unsafe document %j",
    (text) => {
      expect(() => parseMemoryDocument(text)).toThrow();
    },
  );
});

describe("memory storage and updates", () => {
  it("reads missing files without creating either scope", async () => {
    expect(await readMemory(options, "global")).toMatchObject({
      exists: false,
      content: "",
      enabled: true,
    });
    expect(await readMemory(options, "project")).toMatchObject({ exists: false });
    expect(await readdir(state.home)).toEqual([]);
    expect(await readdir(options.cwd)).toEqual([]);
  });
  it("isolates scopes, creates defaults, and deduplicates exact additions", async () => {
    await updateMemory(options, { scope: "global", section: "User", newText: "- Prefer pnpm" });
    const result = await updateMemory(options, input("- Project uses npm"));
    expect(result.changed).toBe(true);
    const global = await readMemory(options, "global");
    const project = await readMemory(options, "project");
    expect(global.content).toContain("## Agent");
    expect(global.content).not.toContain("uses npm");
    expect(project.content).toContain("## Architecture");
    expect(project.content).not.toContain("Prefer pnpm");
    expect(await updateMemory(options, input("- Project uses npm"))).toMatchObject({
      changed: false,
    });
    expect((await readMemory(options, "project")).content).toBe(project.content);
  });
  it("corrects and deletes only a unique match in the selected section", async () => {
    const path = await put(
      "project",
      "# Memory\n\n## Architecture\n\n- SSE\n\n## Conventions\n\n- SSE\n",
    );
    await updateMemory(options, input("- RPC", "- SSE"));
    expect(await readFile(path, "utf8")).toContain("## Architecture\n\n- SSE");
    expect(await readFile(path, "utf8")).toContain("## Conventions\n\n- RPC");
    await updateMemory(options, input("", "- RPC"));
    expect(await readFile(path, "utf8")).not.toContain("RPC");
    await expect(updateMemory(options, input("new", "missing"))).rejects.toThrow("exactly once");
    await put("project", "## Conventions\nold old");
    await expect(updateMemory(options, input("new", "old"))).rejects.toThrow("exactly once");
    await expect(updateMemory(options, input("new", ""))).rejects.toThrow("must not be empty");
  });
  it("refuses malformed external edits and new section boundaries without changing disk", async () => {
    const original = "## Conventions\na\n## Conventions\nb";
    const path = await put("project", original);
    await expect(updateMemory(options, input("new"))).rejects.toThrow("Duplicate");
    expect(await readFile(path, "utf8")).toBe(original);
    await put("project", createDefaultMemory("project"));
    await expect(updateMemory(options, input("## Injected\ncontent"))).rejects.toThrow(
      "section headings",
    );
  });
  it("checks UTF-8 byte capacity exactly and allows condensing oversized memory", async () => {
    const result = await updateMemory(options, input("- 中文"));
    const original = (await readMemory(options, "project")).content;
    expect(result.byteCount).toBe(Buffer.byteLength(original));
    await put("project", JSON.stringify({ maxProjectMemoryBytes: result.byteCount }), true);
    await updateMemory(options, input("- 文中", "- 中文"));
    await expect(updateMemory(options, input("x"))).rejects.toThrow("capacity");
    await put("project", JSON.stringify({ maxProjectMemoryBytes: result.byteCount - 1 }), true);
    expect((await readMemory(options, "project")).error).toContain("capacity");
    await updateMemory(options, input("- A", "- 文中"));
    expect((await readMemory(options, "project")).error).toBeUndefined();
  });
  it("serializes concurrent updates without losing entries", async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) => updateMemory(options, input(`- Rule ${index}.`))),
    );
    const text = (await readMemory(options, "project")).content;
    for (let index = 0; index < 12; index++) expect(text).toContain(`- Rule ${index}.`);
    expect(await readdir(join(options.cwd, ".willow/memory"))).toEqual(["MEMORY.md"]);
  });
  it("preserves the original and removes temporary files when atomic rename fails", async () => {
    await updateMemory(options, input("- Original"));
    const original = (await readMemory(options, "project")).content;
    vi.mocked(rename).mockRejectedValueOnce(new Error("rename failed"));
    await expect(updateMemory(options, input("- New"))).rejects.toThrow("rename failed");
    expect((await readMemory(options, "project")).content).toBe(original);
    expect(await readdir(join(options.cwd, ".willow/memory"))).toEqual(["MEMORY.md"]);
  });
  it("does not mutate after abort and creates files only through explicit ensure", async () => {
    await expect(updateMemory(options, input("new"), AbortSignal.abort())).rejects.toThrow(
      "aborted",
    );
    const path = await ensureMemoryFile(options, "project");
    expect(await readFile(path, "utf8")).toBe(createDefaultMemory("project"));
    await writeFile(path, "external edit");
    await ensureMemoryFile(options, "project");
    expect(await readFile(path, "utf8")).toBe("external edit");
  });
});

describe("config and recall", () => {
  it("merges project config and never reads an untrusted project config or file", async () => {
    await put("global", JSON.stringify({ maxGlobalMemoryBytes: 4096 }), true);
    await put("project", JSON.stringify({ enabled: false, maxProjectMemoryBytes: 8192 }), true);
    expect(await resolveMemoryConfig(options)).toMatchObject({
      enabled: false,
      projectEnabled: false,
      maxGlobalMemoryBytes: 4096,
      maxProjectMemoryBytes: 8192,
    });
    const untrusted = { ...options, projectTrusted: false };
    expect(await resolveMemoryConfig(untrusted)).toMatchObject({
      enabled: true,
      projectEnabled: false,
      maxProjectMemoryBytes: 16384,
    });
    expect(await readMemory(untrusted, "project")).toMatchObject({
      exists: false,
      content: "",
      enabled: false,
    });
    await expect(updateMemory(untrusted, input("rule"))).rejects.toThrow("trusted");
  });
  it("disables affected memory and reports invalid configs", async () => {
    await put("project", '{"enabled":"yes"}', true);
    expect(await resolveMemoryConfig(options)).toMatchObject({
      enabled: true,
      projectEnabled: false,
      errors: { project: expect.any(String) },
    });
    await expect(updateMemory(options, input("rule"))).rejects.toThrow("boolean");
    await put("global", '{"maxGlobalMemoryBytes":0}', true);
    expect(await resolveMemoryConfig(options)).toMatchObject({
      enabled: false,
      projectEnabled: false,
      errors: { global: expect.any(String) },
    });
  });
  it("recalls fresh files with precedence and excludes disabled, untrusted and oversized content", async () => {
    await put("global", "## User\n- global preference");
    await put("project", "## Project\n- project constraint");
    const prompt = await getMemoryPrompt(options, true);
    expect(prompt).toContain("global preference");
    expect(prompt).toContain("project constraint");
    expect(prompt).toContain("project memory takes precedence");
    expect(await getMemoryPrompt({ ...options, projectTrusted: false }, true)).not.toContain(
      "project constraint",
    );
    await put("project", "## Project\n- external correction");
    expect(await getMemoryPrompt(options, true)).toContain("external correction");
    await put("project", JSON.stringify({ maxProjectMemoryBytes: 1 }), true);
    expect(await getMemoryPrompt(options, true)).not.toContain("external correction");
    await put("project", JSON.stringify({ enabled: false }), true);
    expect(await getMemoryPrompt(options, true)).toBe("");
  });
  it("uses read-only recall and omits update tools in plan/disabled modes", async () => {
    await put("global", "## User\n- preference");
    expect(await getMemoryPrompt(options, false)).toContain("read-only");
    const runtime = {
      ...options,
      memoryEnabled: true,
      permissionMode: "request-approval" as const,
    };
    expect(createWillowTools(runtime).map((tool) => tool.name)).toContain("memory_update");
    expect(
      createWillowTools({ ...runtime, agentMode: "plan" }).map((tool) => tool.name),
    ).not.toContain("memory_update");
    expect(
      createWillowTools({ ...runtime, memoryEnabled: false }).map((tool) => tool.name),
    ).not.toContain("memory_update");
  });
});

describe("memory permission boundaries", () => {
  it.each(["request-approval", "delegate-approval", "full-access"] as const)(
    "allows fixed files without approval in %s and hard-denies symlinks",
    async (permissionMode) => {
      const approval = vi.fn();
      const tool = new MemoryUpdateTool({ ...options, permissionMode, requestApproval: approval });
      await tool.execute("project", input("- rule"));
      await tool.execute("global", { scope: "global", section: "User", newText: "- preference" });
      expect(approval).not.toHaveBeenCalled();
      const path = getMemoryPath(options, "project");
      await rm(path);
      const outside = join(root, "outside.md");
      await writeFile(outside, "outside");
      await symlink(outside, path);
      await expect(tool.execute("symlink", input("- escape"))).rejects.toThrow("symlink");
      expect(await readFile(outside, "utf8")).toBe("outside");
    },
  );
  it("rejects symlink directories, sensitive workspace anchors and untrusted tools", async () => {
    await symlink(state.home, join(options.cwd, ".willow"));
    await expect(authorizeMemoryPath(options, "project")).rejects.toThrow("symlink");
    await mkdir(join(state.home, ".ssh"));
    await expect(
      authorizeMemoryPath({ cwd: join(state.home, ".ssh"), projectTrusted: true }, "project"),
    ).rejects.toThrow("credential");
    await expect(
      new MemoryUpdateTool({
        ...options,
        projectTrusted: false,
        permissionMode: "full-access",
      }).execute("untrusted", input("x")),
    ).rejects.toThrow("trusted");
  });
  it("rejects canonical aliases of credential directories", async () => {
    const credentials = join(root, "credentials");
    await mkdir(credentials);
    await symlink(credentials, join(state.home, ".ssh"));
    await expect(
      authorizeMemoryPath({ cwd: credentials, projectTrusted: true }, "project"),
    ).rejects.toThrow("credential");
  });
  it("rejects configured write denies even in full-access", async () => {
    const tool = new MemoryUpdateTool({
      ...options,
      permissionMode: "full-access",
      sandboxPolicy: { denyWrite: ["MEMORY.md"] },
    });
    await expect(tool.execute("denied", input("rule"))).rejects.toThrow("Permission denied");
  });
  it("rejects forged actions, fails closed without a registered policy, and does not authorize ordinary global writes", async () => {
    const engine = new DefaultPermissionEngine();
    const context = {
      sessionId: "s",
      toolCallId: "c",
      toolName: "memory_update" as const,
      input: input("x"),
      workspaceRoot: options.cwd,
      projectTrusted: true,
      action: normalizeApprovalAction("memory_update", input("x"), options),
    };
    expect((await engine.evaluate(context)).action).toBe("allow");
    expect(
      (
        await engine.evaluate({
          ...context,
          action: {
            type: "filesystem",
            operation: "write",
            paths: [join(root, "outside")],
            cwd: options.cwd,
          },
        })
      ).action,
    ).toBe("deny");
    expect((await new DefaultPermissionEngine([]).evaluate(context)).action).toBe("deny");
    const globalPath = getMemoryPath(options, "global");
    expect(
      (
        await engine.evaluate({
          ...context,
          toolName: "write",
          input: { path: globalPath },
          action: normalizeApprovalAction("write", { path: globalPath }, options),
        })
      ).action,
    ).toBe("review");
  });
});

describe("explicit memory saves", () => {
  it("creates, replaces and clears complete documents", async () => {
    await saveMemory(options, "project", "偏好", null);
    await saveMemory(options, "project", "修正", "偏好");
    await saveMemory(options, "project", "", "修正");
    expect((await readMemory(options, "project")).content).toBe("");
  });
  it("serializes concurrent saves and rejects stale contents", async () => {
    const results = await Promise.allSettled([
      saveMemory(options, "project", "first", null),
      saveMemory(options, "project", "second", null),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(saveMemory(options, "project", "stale", null)).rejects.toThrow("已被更新");
  });
  it("enforces UTF-8 capacity and rejects unsafe Markdown without writing", async () => {
    await put("global", JSON.stringify({ maxProjectMemoryBytes: 6 }), true);
    await saveMemory(options, "project", "中文", null);
    await expect(saveMemory(options, "project", "中文字", "中文")).rejects.toThrow("容量");
    await expect(saveMemory(options, "project", "## A\n## A", "中文")).rejects.toThrow();
    expect((await readMemory(options, "project")).content).toBe("中文");
  });
  it("allows manual edits when recall is disabled but rejects untrusted paths", async () => {
    await put("global", '{"enabled":false}', true);
    await saveMemory(options, "global", "manual", null);
    await expect(
      saveMemory({ ...options, projectTrusted: false }, "project", "bad", null),
    ).rejects.toThrow();
  });
});

describe("memory master switch", () => {
  it("defaults on and persists disable/enable without losing capacities", async () => {
    expect((await resolveMemoryConfig(options)).enabled).toBe(true);
    await put("global", '{"maxGlobalMemoryBytes":2048,"custom":"keep"}', true);
    await put("project", '{"enabled":true}', true);
    await setMemoryEnabled(options, false);
    expect(await resolveMemoryConfig(options)).toMatchObject({
      enabled: false,
      projectEnabled: false,
      maxGlobalMemoryBytes: 2048,
    });
    expect(await getMemoryPrompt(options, true)).toBe("");
    expect(
      JSON.parse(await readFile(getMemoryPath(options, "global", true), "utf8")),
    ).toMatchObject({ custom: "keep", enabled: false });
    await setMemoryEnabled(options, true);
    expect((await resolveMemoryConfig(options)).projectEnabled).toBe(true);
  });
  it("rejects symbolic links and malformed config without overwriting", async () => {
    await put("global", "bad", true);
    await expect(setMemoryEnabled(options, false)).rejects.toThrow();
    expect(await readFile(getMemoryPath(options, "global", true), "utf8")).toBe("bad");
    await rm(getMemoryPath(options, "global", true));
    await symlink(join(root, "other.json"), getMemoryPath(options, "global", true));
    await expect(setMemoryEnabled(options, false)).rejects.toThrow("symlink");
  });
});
