import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetSkillListController } from "../src/main/controllers/skill/get-list.skill.controller";
import type { SkillService } from "../src/main/service/skill.service";
import { WorkspaceNotFoundError } from "../src/main/service/workspace.service";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const getSkillList = vi.fn<SkillService["getSkillList"]>();
const service = { getSkillList } as unknown as SkillService;
const controller = new GetSkillListController(service);

describe("GetSkillListController", () => {
  beforeEach(() => {
    getSkillList.mockReset();
  });

  it("returns the workspace skill list", async () => {
    const skills = [
      {
        name: "review",
        description: "Review the implementation",
        filePath: "/workspace/.willow/skills/review/SKILL.md",
      },
    ];
    getSkillList.mockResolvedValueOnce(skills);

    await expect(controller.run(event, { workspaceId: 7 })).resolves.toEqual({
      code: 0,
      data: { skills },
      msg: "ok",
    });
    expect(getSkillList).toHaveBeenCalledWith(7);
  });

  it.each([undefined, {}, { workspaceId: 0 }, { workspaceId: 1.5 }])(
    "rejects invalid input without calling the service",
    async (request) => {
      await expect(controller.run(event, request as never)).resolves.toEqual({
        code: 400,
        msg: "workspaceId must be a positive integer",
      });
      expect(getSkillList).not.toHaveBeenCalled();
    },
  );

  it("maps a missing workspace to 404", async () => {
    getSkillList.mockRejectedValueOnce(new WorkspaceNotFoundError(9));

    await expect(controller.run(event, { workspaceId: 9 })).resolves.toEqual({
      code: 404,
      msg: "Workspace not found",
    });
  });

  it("propagates skill loading failures", async () => {
    const error = new Error("skill scan failed");
    getSkillList.mockRejectedValueOnce(error);

    await expect(controller.run(event, { workspaceId: 1 })).rejects.toBe(error);
  });
});
