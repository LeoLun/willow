import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemorySessionRepo } from "@earendil-works/pi-agent-core";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentCore } from "../src/core.js";

const state = vi.hoisted(() => ({
  home: "",
  hooks: new Map<string, (event: { systemPrompt: string }) => Promise<{ systemPrompt: string }>>(),
  toolNames: [] as string[],
}));
vi.mock("node:os", async (original) => {
  const os = await original<typeof import("node:os")>();
  return { ...os, homedir: () => state.home || os.homedir() };
});
vi.mock("@earendil-works/pi-agent-core", async (original) => {
  const agent = await original<typeof import("@earendil-works/pi-agent-core")>();
  return {
    ...agent,
    AgentHarness: class {
      constructor(options: { tools: { name: string }[] }) {
        state.toolNames = options.tools.map((tool) => tool.name);
      }
      on(
        name: string,
        callback: (event: { systemPrompt: string }) => Promise<{ systemPrompt: string }>,
      ) {
        state.hooks.set(name, callback);
      }
    },
  };
});
let root: string;
let cwd: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "willow-recall-"));
  state.home = join(root, "home");
  cwd = join(root, "project");
  await Promise.all([
    mkdir(join(state.home, ".willow/memory"), { recursive: true }),
    mkdir(join(cwd, ".willow/memory"), { recursive: true }),
  ]);
  state.hooks.clear();
  state.toolNames = [];
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  state.home = "";
});
async function construct(projectTrusted?: boolean, agentMode?: "plan") {
  const models = builtinModels();
  await new AgentCore({
    cwd,
    projectTrusted,
    models,
    sessionRepo: new InMemorySessionRepo(),
  }).getAgentHarness({ model: models.getModel("deepseek", "deepseek-v4-flash")!, agentMode });
}
async function recall() {
  return (await state.hooks.get("before_agent_start")!({ systemPrompt: "Base prompt" }))
    .systemPrompt;
}

describe("AgentCore memory lifecycle wiring", () => {
  it("registers recall and rereads external edits without accumulating injections", async () => {
    const path = join(cwd, ".willow/memory/MEMORY.md");
    await writeFile(path, "## Project\nOriginal convention");
    await construct(true);
    expect(state.toolNames).toContain("memory_update");
    expect(await recall()).toContain("Original convention");
    await writeFile(path, "## Project\nCorrected convention");
    const next = await recall();
    expect(next).toContain("Corrected convention");
    expect(next).not.toContain("Original convention");
    expect(next.match(/Persistent memory survives/g)).toHaveLength(1);
    await construct(true);
    expect(await recall()).toContain("Corrected convention");
  });
  it("defaults project trust off and never injects project content", async () => {
    await writeFile(join(cwd, ".willow/memory/MEMORY.md"), "## Project\nUNTRUSTED");
    await construct();
    expect(await recall()).not.toContain("UNTRUSTED");
  });
  it("omits write tool in plan mode and reads existing memory", async () => {
    await writeFile(join(state.home, ".willow/memory/MEMORY.md"), "## User\nRemember this");
    await construct(true, "plan");
    expect(state.toolNames).not.toContain("memory_update");
    expect(await recall()).toContain("Remember this");
    expect(await recall()).toContain("read-only");
  });
  it("omits both the tool and memory injection when disabled", async () => {
    await writeFile(join(state.home, ".willow/memory/config.json"), '{"enabled":false}');
    await writeFile(join(state.home, ".willow/memory/MEMORY.md"), "## User\nDisabled content");
    await construct(true);
    expect(state.toolNames).not.toContain("memory_update");
    expect(await recall()).toBe("Base prompt");
  });
});
