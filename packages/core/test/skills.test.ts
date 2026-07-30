import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentCore } from "../src/core";

const temporaryDirectories: string[] = [];

async function writeSkill(directory: string, name: string, description: string) {
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("AgentCore skills", () => {
  it("returns freshly loaded global and workspace skills with their real paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "willow-core-skills-"));
    temporaryDirectories.push(root);
    const cwd = join(root, "workspace");
    const agentDir = join(root, ".willow");
    const globalSkillPath = join(agentDir, "skills", "global-review");
    const workspaceSkillPath = join(cwd, ".willow", "skills", "workspace-review");
    await writeSkill(globalSkillPath, "global-review", "Review changes globally");
    await writeSkill(workspaceSkillPath, "workspace-review", "Review this workspace");

    const core = new AgentCore({
      cwd,
      agentDir,
      models: {} as never,
      sessionRepo: {} as never,
    });

    await expect(core.getSkills()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "global-review",
          description: "Review changes globally",
          filePath: join(globalSkillPath, "SKILL.md"),
        }),
        expect.objectContaining({
          name: "workspace-review",
          description: "Review this workspace",
          filePath: join(workspaceSkillPath, "SKILL.md"),
        }),
      ]),
    );
  });

  it("loads enabled built-in skills and only filters disabled skills from the built-in source", async () => {
    const root = await mkdtemp(join(tmpdir(), "willow-core-builtin-skills-"));
    temporaryDirectories.push(root);
    const cwd = join(root, "workspace");
    const agentDir = join(root, ".willow");
    const builtinSkillsDirectory = join(root, "builtin-skills");
    const builtinReviewPath = join(builtinSkillsDirectory, "review");
    const builtinDocsPath = join(builtinSkillsDirectory, "write-docs");
    const workspaceReviewPath = join(cwd, ".willow", "skills", "review");
    await writeSkill(builtinReviewPath, "review", "Built-in review");
    await writeSkill(builtinDocsPath, "write-docs", "Built-in documentation");
    await writeSkill(workspaceReviewPath, "review", "Workspace review");

    const core = new AgentCore({
      cwd,
      agentDir,
      builtinSkills: {
        directory: builtinSkillsDirectory,
        disabledIds: ["review"],
      },
      models: {} as never,
      sessionRepo: {} as never,
    });

    const skills = await core.getSkills();
    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "write-docs",
          filePath: join(builtinDocsPath, "SKILL.md"),
        }),
        expect.objectContaining({
          name: "review",
          filePath: join(workspaceReviewPath, "SKILL.md"),
        }),
      ]),
    );
    expect(skills).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: join(builtinReviewPath, "SKILL.md"),
        }),
      ]),
    );
  });
});
