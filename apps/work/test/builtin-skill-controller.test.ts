import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetBuiltinSkillListController } from "../src/main/controllers/skill/get-builtin-list.skill.controller";
import { SetBuiltinSkillEnabledController } from "../src/main/controllers/skill/set-builtin-enabled.skill.controller";
import {
  BuiltinSkillNotFoundError,
  type BuiltinSkillService,
} from "../src/main/service/builtin-skill.service";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const getBuiltinSkillList = vi.fn<BuiltinSkillService["getBuiltinSkillList"]>();
const setBuiltinSkillEnabled = vi.fn<BuiltinSkillService["setBuiltinSkillEnabled"]>();
const service = { getBuiltinSkillList, setBuiltinSkillEnabled } as unknown as BuiltinSkillService;
const getController = new GetBuiltinSkillListController(service);
const setController = new SetBuiltinSkillEnabledController(service);

const skill = {
  id: "review",
  name: "review",
  description: "Review changes",
  scope: "global" as const,
  enabled: true,
};

describe("built-in skill controllers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the global built-in skill list", async () => {
    getBuiltinSkillList.mockResolvedValueOnce([skill]);

    await expect(getController.run(event, {})).resolves.toEqual({
      code: 0,
      data: { skills: [skill] },
      msg: "ok",
    });
  });

  it("updates a valid built-in skill", async () => {
    const disabled = { ...skill, enabled: false };
    setBuiltinSkillEnabled.mockResolvedValueOnce(disabled);

    await expect(setController.run(event, { id: "review", enabled: false })).resolves.toEqual({
      code: 0,
      data: { skill: disabled },
      msg: "ok",
    });
    expect(setBuiltinSkillEnabled).toHaveBeenCalledWith("review", false);
  });

  it.each([
    [undefined, "request must be an object"],
    [{}, "id must be a valid skill id"],
    [{ id: "", enabled: true }, "id must be a valid skill id"],
    [{ id: "Invalid Skill", enabled: true }, "id must be a valid skill id"],
    [{ id: "review", enabled: "yes" }, "enabled must be a boolean"],
  ])("rejects invalid settings without calling the service", async (request, message) => {
    await expect(setController.run(event, request as never)).resolves.toEqual({
      code: 400,
      msg: message,
    });
    expect(setBuiltinSkillEnabled).not.toHaveBeenCalled();
  });

  it("maps unknown skills to 404", async () => {
    setBuiltinSkillEnabled.mockRejectedValueOnce(new BuiltinSkillNotFoundError("missing"));

    await expect(setController.run(event, { id: "missing", enabled: false })).resolves.toEqual({
      code: 404,
      msg: "Built-in skill not found",
    });
  });

  it("propagates loading and persistence failures", async () => {
    const loadError = new Error("scan failed");
    getBuiltinSkillList.mockRejectedValueOnce(loadError);
    await expect(getController.run(event, {})).rejects.toBe(loadError);

    const saveError = new Error("database failed");
    setBuiltinSkillEnabled.mockRejectedValueOnce(saveError);
    await expect(setController.run(event, { id: "review", enabled: false })).rejects.toBe(
      saveError,
    );
  });
});
