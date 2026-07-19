import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  fromWebContents: vi.fn(),
  showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    fromWebContents: electronMocks.fromWebContents,
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog,
  },
}));

import { SelectWorkspaceDirectoryController } from "../src/main/controllers/workspace/select-directory.workspace.controller";

const sender = {} as Electron.WebContents;
const event = { sender } as Electron.IpcMainInvokeEvent;
const controller = new SelectWorkspaceDirectoryController();

describe("SelectWorkspaceDirectoryController", () => {
  beforeEach(() => {
    electronMocks.fromWebContents.mockReset();
    electronMocks.showOpenDialog.mockReset();
  });

  it("returns the selected directory name and path", async () => {
    const parentWindow = {};
    electronMocks.fromWebContents.mockReturnValueOnce(parentWindow);
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/workspace/willow"],
    });

    await expect(controller.run(event, {})).resolves.toEqual({
      code: 0,
      data: { directory: { name: "willow", path: "/workspace/willow" } },
      msg: "ok",
    });
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith(
      parentWindow,
      expect.objectContaining({
        title: "选择工作空间文件夹",
        properties: ["openDirectory"],
      }),
    );
  });

  it("returns null when directory selection is canceled", async () => {
    electronMocks.fromWebContents.mockReturnValueOnce(null);
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });

    await expect(controller.run(event, {})).resolves.toEqual({
      code: 0,
      data: { directory: null },
      msg: "ok",
    });
  });

  it("propagates native dialog failures", async () => {
    const error = new Error("dialog failed");
    electronMocks.fromWebContents.mockReturnValueOnce(null);
    electronMocks.showOpenDialog.mockRejectedValueOnce(error);

    await expect(controller.run(event, {})).rejects.toBe(error);
  });
});
