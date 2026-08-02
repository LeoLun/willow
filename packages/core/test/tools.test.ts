import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEditTool,
  createBashTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWillowTools,
  createWriteTool,
  ToolBase,
  type BaseDetails,
  type ToolApprovalHandler,
} from "../src/index.js";

const temporaryDirectories: string[] = [];
const baseDetails: BaseDetails = { msg: "摘要" };

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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("filesystem tools", () => {
  it("creates every built-in tool through ToolBase-backed factories", () => {
    const tools = createWillowTools({ cwd: process.cwd(), permissionMode: "full-access" });
    expect(tools).toHaveLength(9);
    expect(tools.every((tool) => tool instanceof ToolBase)).toBe(true);
  });

  it("writes, reads, lists, and edits files with display details", async () => {
    expect(baseDetails.msg).toBe("摘要");
    const cwd = await temporaryDirectory("willow-tools-");
    const runtime = { cwd, permissionMode: "full-access" as const };
    const write = createWriteTool(runtime);
    const read = createReadTool(runtime);
    const ls = createLsTool(runtime);
    const edit = createEditTool(runtime);

    const written = await write.execute("write-1", {
      path: "src/example.txt",
      content: "alpha\r\nbeta\r\n",
    });
    expect(written.details).toMatchObject({
      msg: "写入 src/example.txt 文件 2 行",
      kind: "write",
      lineCount: 2,
    });

    const readResult = await read.execute("read-1", {
      path: "src/example.txt",
      offset: 2,
      limit: 1,
    });
    expect(readResult.content).toEqual([{ type: "text", text: "beta" }]);
    expect(readResult.details).toMatchObject({
      msg: "读取 src/example.txt 文件 2-2 行",
      kind: "read",
      lineCount: 1,
      offset: 2,
    });

    const listed = await ls.execute("ls-1", { path: "src" });
    expect(listed.content[0]).toMatchObject({ type: "text", text: "example.txt" });
    expect(listed.details).toMatchObject({
      msg: "列出 src 目录，共 1 项",
      kind: "ls",
      entryCount: 1,
    });

    const edited = await edit.execute("edit-1", {
      path: "src/example.txt",
      edits: [{ oldText: "beta", newText: "beta\ngamma" }],
    });
    expect(edited.details).toMatchObject({
      msg: "修改 src/example.txt 文件 +1 -0",
      kind: "edit",
      addedLines: 1,
      removedLines: 0,
    });
    expect(await readFile(join(cwd, "src/example.txt"), "utf8")).toBe("alpha\r\nbeta\r\ngamma\r\n");
  });

  it("summarizes an empty read without an invalid line range", async () => {
    const cwd = await temporaryDirectory("willow-read-empty-");
    await writeFile(join(cwd, "empty.txt"), "");

    const result = await createReadTool({ cwd, permissionMode: "full-access" }).execute("read", {
      path: "empty.txt",
    });

    expect(result.details.msg).toBe("读取 empty.txt 文件 0 行");
  });

  it("rejects missing, ambiguous, and overlapping edits without modifying the file", async () => {
    const cwd = await temporaryDirectory("willow-edit-");
    const path = join(cwd, "example.txt");
    await writeFile(path, "same\nmiddle\nsame\n", "utf8");
    const edit = createEditTool({ cwd, permissionMode: "full-access" });

    await expect(
      edit.execute("ambiguous", {
        path,
        edits: [{ oldText: "same", newText: "changed" }],
      }),
    ).rejects.toThrow("exactly one");
    await expect(
      edit.execute("missing", {
        path,
        edits: [{ oldText: "absent", newText: "changed" }],
      }),
    ).rejects.toThrow("not found");
    expect(await readFile(path, "utf8")).toBe("same\nmiddle\nsame\n");
  });

  it("validates semantic parameters before requesting permission or touching files", async () => {
    const cwd = await temporaryDirectory("willow-validation-");
    const outside = join(cwd, "..", "outside-validation.txt");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const runtime = {
      cwd,
      permissionMode: "request-approval" as const,
      requestApproval,
    };

    await expect(
      createReadTool(runtime).execute("read-invalid", { path: outside, offset: 0 }),
    ).rejects.toThrow("offset must be at least 1");
    await expect(
      createFindTool(runtime).execute("find-invalid", {
        path: outside,
        pattern: "*",
        limit: 0,
      }),
    ).rejects.toThrow("limit must be at least 1");
    await expect(
      createGrepTool(runtime).execute("grep-context-invalid", {
        path: outside,
        pattern: "value",
        context: -1,
      }),
    ).rejects.toThrow("context must be non-negative");
    await expect(
      createGrepTool(runtime).execute("grep-pattern-invalid", {
        path: outside,
        pattern: "[",
      }),
    ).rejects.toThrow();
    await expect(
      createEditTool(runtime).execute("edit-invalid", {
        path: outside,
        edits: [{ oldText: "", newText: "value" }],
      }),
    ).rejects.toThrow("oldText must not be empty");
    await expect(
      createBashTool(runtime).execute("bash-invalid", {
        command: "printf test",
        timeout: 0,
      }),
    ).rejects.toThrow("Invalid timeout");

    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("requests approval for workspace escapes, including symlink escapes", async () => {
    const parent = await temporaryDirectory("willow-permission-");
    const cwd = join(parent, "workspace");
    const outside = join(parent, "outside");
    await mkdir(cwd);
    await mkdir(outside);
    await symlink(outside, join(cwd, "escape"));
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");
    const write = createWriteTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
    });

    await expect(
      write.execute("write-outside", { path: "escape/file.txt", content: "blocked" }),
    ).rejects.toThrow("Permission denied");
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "write-outside",
        reason: "outside-workspace-write",
      }),
      undefined,
    );
  });

  it("authorizes read-only tools before reading outside the workspace", async () => {
    const parent = await temporaryDirectory("willow-read-permission-");
    const cwd = join(parent, "workspace");
    const outside = join(parent, "outside");
    await mkdir(cwd);
    await mkdir(outside);
    await writeFile(join(outside, "example.txt"), "Needle\n", "utf8");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const runtime = {
      cwd,
      permissionMode: "request-approval" as const,
      requestApproval,
    };

    await createReadTool(runtime).execute("read-outside", {
      path: join(outside, "example.txt"),
    });
    await createLsTool(runtime).execute("ls-outside", { path: outside });
    await createGrepTool(runtime).execute("grep-outside", {
      path: outside,
      pattern: "Needle",
    });
    await createFindTool(runtime).execute("find-outside", {
      path: outside,
      pattern: "*.txt",
    });

    expect(requestApproval).toHaveBeenCalledTimes(4);
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "read-outside",
        reason: "outside-workspace-read",
        display: join(outside, "example.txt"),
      }),
      undefined,
    );
  });

  it("allows configured built-in skill reads without allowing writes", async () => {
    const parent = await temporaryDirectory("willow-builtin-skill-permission-");
    const cwd = join(parent, "workspace");
    const builtinSkills = join(parent, "builtin-skills");
    await mkdir(cwd);
    await mkdir(builtinSkills);
    const skillPath = join(builtinSkills, "SKILL.md");
    await writeFile(skillPath, "built-in skill", "utf8");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");
    const runtime = {
      cwd,
      permissionMode: "request-approval" as const,
      requestApproval,
      sandboxPolicy: { allowRead: [builtinSkills] },
    };

    await expect(
      createReadTool(runtime).execute("read-builtin", { path: skillPath }),
    ).resolves.toEqual(
      expect.objectContaining({
        content: [{ type: "text", text: "built-in skill" }],
      }),
    );
    await expect(
      createWriteTool(runtime).execute("write-builtin", {
        path: skillPath,
        content: "changed",
      }),
    ).rejects.toThrow("Permission denied");
    expect(requestApproval).toHaveBeenCalledTimes(1);
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "write-builtin",
        reason: "outside-workspace-write",
      }),
      undefined,
    );
  });

  it("allows read-only tools inside global skills without allowing symlink escapes", async () => {
    const parent = await temporaryDirectory("willow-global-skills-read-");
    const cwd = join(parent, "workspace");
    const agentDir = join(parent, "global-agent");
    const skillsDirectory = join(agentDir, "skills");
    const outside = join(parent, "outside");
    await mkdir(cwd);
    await mkdir(skillsDirectory, { recursive: true });
    await mkdir(outside);
    await writeFile(join(skillsDirectory, "example.txt"), "Needle\n", "utf8");
    await writeFile(join(outside, "secret.txt"), "secret\n", "utf8");
    await symlink(outside, join(skillsDirectory, "escape"));
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");
    const runtime = {
      cwd,
      agentDir,
      permissionMode: "request-approval" as const,
      requestApproval,
    };

    await createReadTool(runtime).execute("read-global-skill", {
      path: join(skillsDirectory, "example.txt"),
    });
    await createLsTool(runtime).execute("ls-global-skills", { path: skillsDirectory });
    await createGrepTool(runtime).execute("grep-global-skills", {
      path: skillsDirectory,
      pattern: "Needle",
    });
    await createFindTool(runtime).execute("find-global-skills", {
      path: skillsDirectory,
      pattern: "*.txt",
    });

    expect(requestApproval).not.toHaveBeenCalled();

    await expect(
      createReadTool(runtime).execute("read-global-skill-escape", {
        path: join(skillsDirectory, "escape", "secret.txt"),
      }),
    ).rejects.toThrow("Permission denied");
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "read-global-skill-escape",
        reason: "outside-workspace-read",
      }),
      undefined,
    );
  });

  it("allows write tools inside global skills without weakening hard denies", async () => {
    const parent = await temporaryDirectory("willow-global-skills-write-");
    const cwd = join(parent, "workspace");
    const agentDir = join(parent, "global-agent");
    const skillsDirectory = join(agentDir, "skills");
    const outside = join(parent, "outside");
    await mkdir(cwd);
    await mkdir(skillsDirectory, { recursive: true });
    await mkdir(outside);
    await symlink(outside, join(skillsDirectory, "escape"));
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");
    const runtime = {
      cwd,
      agentDir,
      permissionMode: "request-approval" as const,
      requestApproval,
    };
    const skillPath = join(skillsDirectory, "custom", "SKILL.md");

    await createWriteTool(runtime).execute("write-global-skill", {
      path: skillPath,
      content: "name: custom\n",
    });
    await createEditTool(runtime).execute("edit-global-skill", {
      path: skillPath,
      edits: [{ oldText: "custom", newText: "customized" }],
    });

    expect(await readFile(skillPath, "utf8")).toBe("name: customized\n");
    expect(requestApproval).not.toHaveBeenCalled();

    await expect(
      createWriteTool(runtime).execute("write-global-skill-escape", {
        path: join(skillsDirectory, "escape", "outside.txt"),
        content: "blocked",
      }),
    ).rejects.toThrow("Permission denied");
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "write-global-skill-escape",
        reason: "outside-workspace-write",
      }),
      undefined,
    );

    requestApproval.mockClear();
    await expect(
      createWriteTool(runtime).execute("write-global-skill-secret", {
        path: join(skillsDirectory, "custom", ".env"),
        content: "SECRET=value\n",
      }),
    ).rejects.toThrow("Sensitive write denied");
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("hard-blocks sensitive writes in sandboxed modes", async () => {
    const cwd = await temporaryDirectory("willow-sensitive-write-");
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

    await expect(
      createWriteTool({
        cwd,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("write-env", { path: ".env.local", content: "SECRET=value\n" }),
    ).rejects.toThrow("Sensitive write denied");
    expect(requestApproval).not.toHaveBeenCalled();

    await createWriteTool({ cwd, permissionMode: "full-access" }).execute("write-env-full", {
      path: ".env.local",
      content: "SECRET=value\n",
    });
    expect(await readFile(join(cwd, ".env.local"), "utf8")).toBe("SECRET=value\n");
  });
});

describe("bash tool", () => {
  it("executes commands directly in full-access mode", async () => {
    const cwd = await temporaryDirectory("willow-bash-full-");
    const onUpdate = vi.fn();
    const result = await createBashTool({ cwd, permissionMode: "full-access" }).execute(
      "bash-full",
      { command: "printf 'hello'" },
      undefined,
      onUpdate,
    );
    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
    expect(result.details).toMatchObject({
      msg: "执行 printf 'hello'",
      kind: "bash",
      sandboxed: false,
      exitCode: 0,
    });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ msg: "执行 printf 'hello'", kind: "bash" }),
      }),
    );
  });

  it.runIf(process.platform === "darwin")(
    "executes safe commands through sandbox-exec",
    async () => {
      const cwd = await temporaryDirectory("willow-bash-sandbox-");
      const result = await createBashTool({ cwd, permissionMode: "request-approval" }).execute(
        "bash-sandbox",
        { command: "printf 'sandboxed'" },
      );
      expect(result.content).toEqual([{ type: "text", text: "sandboxed" }]);
      expect(result.details).toMatchObject({ kind: "bash", sandboxed: true, exitCode: 0 });
    },
  );

  const globalSkillsDirectory = join(homedir(), ".willow", "skills");
  it.runIf(process.platform === "darwin" && existsSync(globalSkillsDirectory))(
    "reads the global Willow skills directory through sandbox-exec",
    async () => {
      const cwd = await temporaryDirectory("willow-bash-global-skills-");
      const result = await createBashTool({
        cwd,
        agentDir: ".willow",
        permissionMode: "request-approval",
      }).execute("bash-global-skills", {
        command: `test -r ${JSON.stringify(globalSkillsDirectory)} && printf 'skills-readable'`,
      });

      expect(result.content).toEqual([{ type: "text", text: "skills-readable" }]);
      expect(result.details).toMatchObject({ kind: "bash", sandboxed: true, exitCode: 0 });
    },
  );

  it.runIf(process.platform === "darwin")(
    "writes custom global skills through sandbox-exec",
    async () => {
      const root = await workspaceTemporaryDirectory(".willow-global-skills-write-");
      const cwd = join(root, "workspace");
      const agentDir = join(root, "global-agent");
      const skillsDirectory = join(agentDir, "skills");
      const skillPath = join(skillsDirectory, "custom", "SKILL.md");
      await mkdir(cwd);
      await mkdir(skillsDirectory, { recursive: true });
      const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");

      const result = await createBashTool({
        cwd,
        agentDir,
        permissionMode: "request-approval",
        requestApproval,
      }).execute("bash-write-global-skill", {
        command: `mkdir -p ${JSON.stringify(join(skillsDirectory, "custom"))} && printf 'name: custom\\n' > ${JSON.stringify(skillPath)}`,
      });

      expect(result.details).toMatchObject({ kind: "bash", sandboxed: true, exitCode: 0 });
      expect(await readFile(skillPath, "utf8")).toBe("name: custom\n");
      expect(requestApproval).not.toHaveBeenCalled();
    },
  );

  it.runIf(process.platform === "darwin")(
    "requests, delegates, and bypasses approval for sandbox escapes",
    async () => {
      const root = await workspaceTemporaryDirectory(".willow-sandbox-");
      const cwd = join(root, "workspace");
      await mkdir(cwd);
      const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");
      const command = "printf 'outside' > ../outside.txt";

      await expect(
        createBashTool({
          cwd,
          permissionMode: "request-approval",
          requestApproval,
        }).execute("request", { command }),
      ).rejects.toThrow("Permission denied");
      expect(requestApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "outside-workspace-write",
          mayHavePartialEffects: true,
        }),
        undefined,
      );

      const delegatedApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
      const delegated = await createBashTool({
        cwd,
        permissionMode: "delegate-approval",
        requestApproval: delegatedApproval,
      }).execute("delegate", { command });
      expect(delegatedApproval).toHaveBeenCalledWith(
        expect.objectContaining({ toolCallId: "delegate", reason: "outside-workspace-write" }),
        undefined,
      );
      expect(delegated.details).toMatchObject({ sandboxed: true, exitCode: 0 });
      expect(await readFile(join(root, "outside.txt"), "utf8")).toBe("outside");

      await expect(
        createBashTool({ cwd, permissionMode: "delegate-approval" }).execute(
          "delegate-without-handler",
          { command },
        ),
      ).rejects.toThrow("Permission denied");

      await createBashTool({ cwd, permissionMode: "full-access" }).execute("full", {
        command: "printf 'full' > ../outside.txt",
      });
      expect(await readFile(join(root, "outside.txt"), "utf8")).toBe("full");
    },
  );
});

describe("search tools", () => {
  it("finds and greps text while respecting gitignore and skipping binary files", async () => {
    const cwd = await temporaryDirectory("willow-search-");
    await mkdir(join(cwd, "src"), { recursive: true });
    await mkdir(join(cwd, "ignored"), { recursive: true });
    await writeFile(join(cwd, ".gitignore"), "ignored/\n");
    await writeFile(join(cwd, "src", "one.ts"), "first\nNeedle\nlast\n");
    await writeFile(join(cwd, "ignored", "two.ts"), "Needle\n");
    await writeFile(join(cwd, "src", "binary.dat"), Buffer.from([0, 78, 101, 101, 100, 108, 101]));
    const runtime = { cwd, permissionMode: "full-access" as const };

    const found = await createFindTool(runtime).execute("find-1", {
      pattern: "**/*.ts",
    });
    expect(found.content[0]).toMatchObject({ type: "text", text: "src/one.ts" });
    expect(found.details).toMatchObject({
      msg: "搜索文件 **/*.ts，找到 1 个",
      kind: "find",
      resultCount: 1,
    });

    const grepped = await createGrepTool(runtime).execute("grep-1", {
      pattern: "needle",
      ignoreCase: true,
      context: 1,
    });
    expect(grepped.content[0]).toMatchObject({
      type: "text",
      text: "src/one.ts:1:first\nsrc/one.ts:2:Needle\nsrc/one.ts:3:last",
    });
    expect(grepped.details).toMatchObject({
      msg: "搜索内容 needle，匹配 1 处",
      kind: "grep",
      matchCount: 1,
    });
  });
});
