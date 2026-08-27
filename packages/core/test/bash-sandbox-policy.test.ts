import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BashToolError,
  createBashTool,
  type PermissionEvent,
  type ToolApprovalHandler,
} from "../src/index.js";

const enabled = process.platform === "darwin" && process.env.WILLOW_RUN_SANDBOX_TESTS === "1";
const suite = enabled ? describe : describe.skip;

suite("macOS workspace-write sandbox", () => {
  let root: string;
  let cwd: string;
  let outside: string;
  const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");

  beforeAll(async () => {
    root = await mkdtemp(join(homedir(), ".willow-sandbox-test-"));
    cwd = join(root, "workspace");
    outside = join(root, "outside");
    await mkdir(cwd);
    await mkdir(outside);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function tool(events: PermissionEvent[] = []) {
    return createBashTool({
      cwd,
      sessionId: "sandbox-session",
      permissionMode: "request-approval",
      requestApproval,
      permissionEventSink: (event) => {
        events.push(event);
      },
    });
  }

  it("writes inside the workspace and system temp directory", async () => {
    await tool().execute("workspace-write", { command: "printf workspace > result.txt" });
    expect(await readFile(join(cwd, "result.txt"), "utf8")).toBe("workspace");

    const temporary = join(tmpdir(), `willow-sandbox-${process.pid}.txt`);
    try {
      await tool().execute("tmp-write", { command: `printf temporary > ${temporary}` });
      expect(await readFile(temporary, "utf8")).toBe("temporary");
    } finally {
      await rm(temporary, { force: true });
    }
  }, 30_000);

  it("blocks direct and child-process writes outside authorized roots", async () => {
    const direct = join(outside, "direct.txt");
    const directError = await tool()
      .execute("outside-direct", { command: `printf blocked > ${direct}` })
      .catch((error: unknown) => error);
    expect(directError).toBeInstanceOf(BashToolError);
    expect(directError).toMatchObject({
      code: "SANDBOX_DENIED",
      escalationToken: expect.any(String),
      violations: expect.arrayContaining([
        expect.objectContaining({ type: "filesystem-write", path: direct }),
      ]),
    });

    const child = join(outside, "child.txt");
    const events: PermissionEvent[] = [];
    await expect(
      tool(events).execute("outside-child", {
        command: `node -e "require('node:fs').writeFileSync('${child}','blocked')"`,
      }),
    ).rejects.toThrow("SANDBOX_DENIED");
    expect(events).toContainEqual(
      expect.objectContaining({ type: "sandbox", denied: true, mode: "workspace-write" }),
    );
  }, 30_000);

  it("blocks sensitive reads through a child process", async () => {
    // The fixture is created by the host test, not by a tool call that would be hard-denied.
    await writeFile(join(cwd, ".env.sandbox-test"), "secret", "utf8");
    await expect(
      tool().execute("sensitive-child", {
        command:
          "node -e \"process.stdout.write(require('node:fs').readFileSync('.'+'env.sandbox-test','utf8'))\"",
      }),
    ).rejects.toThrow("SANDBOX_DENIED");
  }, 30_000);

  it("allows outbound network and strips inherited secrets", async () => {
    process.env.WILLOW_TEST_API_KEY = "must-not-leak";
    try {
      const environment = await tool().execute("safe-environment", {
        command: "node -e \"process.stdout.write(process.env.WILLOW_TEST_API_KEY || 'missing')\"",
      });
      expect(environment.content).toEqual([{ type: "text", text: "missing" }]);

      const network = await tool().execute("network", {
        command: "curl -sS --max-time 10 https://example.com",
        timeout: 20,
      });
      expect(network.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Example Domain"),
      });
    } finally {
      delete process.env.WILLOW_TEST_API_KEY;
    }
  }, 60_000);
});
