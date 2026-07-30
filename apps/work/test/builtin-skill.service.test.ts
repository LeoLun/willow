import "reflect-metadata";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  getAppPath: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: electronMocks.getAppPath,
  },
}));

import {
  BuiltinSkillNotFoundError,
  BuiltinSkillService,
} from "../src/main/service/builtin-skill.service";
import type { BuiltinSkillSettingDao } from "../src/main/service/dao/builtin-skill-setting.dao.server";

const temporaryDirectories: string[] = [];

async function writeSkill(root: string, name: string, description: string): Promise<void> {
  const directory = join(root, "resources", "skills", name);
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

describe("BuiltinSkillService", () => {
  const findAll = vi.fn<BuiltinSkillSettingDao["findAll"]>();
  const upsert = vi.fn<BuiltinSkillSettingDao["upsert"]>();
  const dao = { findAll, upsert } as unknown as BuiltinSkillSettingDao;
  let root: string;
  let service: BuiltinSkillService;

  beforeEach(async () => {
    vi.clearAllMocks();
    root = await mkdtemp(join(tmpdir(), "willow-builtin-skill-service-"));
    temporaryDirectories.push(root);
    electronMocks.getAppPath.mockReturnValue(root);
    findAll.mockReturnValue([]);
    service = new BuiltinSkillService(dao);
  });

  it("lists new skills as globally enabled by default", async () => {
    await writeSkill(root, "review", "Review implementation changes");

    await expect(service.getBuiltinSkillList()).resolves.toEqual([
      {
        id: "review",
        name: "review",
        description: "Review implementation changes",
        scope: "global",
        enabled: true,
      },
    ]);
  });

  it("returns persisted disabled ids for AgentCore", () => {
    findAll.mockReturnValue([
      { skillId: "review", enabled: false },
      { skillId: "write-docs", enabled: true },
    ]);

    expect(service.getCoreOptions()).toEqual({
      directory: join(root, "resources", "skills"),
      disabledIds: ["review"],
    });
  });

  it("persists a known skill toggle and returns the updated skill", async () => {
    await writeSkill(root, "review", "Review implementation changes");
    upsert.mockReturnValue({ skillId: "review", enabled: false });

    await expect(service.setBuiltinSkillEnabled("review", false)).resolves.toMatchObject({
      id: "review",
      enabled: false,
    });
    expect(upsert).toHaveBeenCalledWith("review", false);
  });

  it("rejects unknown skills without writing settings", async () => {
    await expect(service.setBuiltinSkillEnabled("missing", false)).rejects.toBeInstanceOf(
      BuiltinSkillNotFoundError,
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});
