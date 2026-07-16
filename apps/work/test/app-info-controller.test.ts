import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getName: vi.fn(() => "Willow"),
    getVersion: vi.fn(() => "0.1.0"),
  },
}));

import { GetAppInfoController } from "../src/main/controllers/app/get-info.app.controller";

describe("GetAppInfoController", () => {
  it("returns the Electron application name and version", async () => {
    const controller = new GetAppInfoController();
    const event = undefined as unknown as Electron.IpcMainInvokeEvent;

    await expect(controller.run(event, {})).resolves.toEqual({
      code: 0,
      data: { name: "Willow", version: "0.1.0" },
      msg: "ok",
    });
  });
});
