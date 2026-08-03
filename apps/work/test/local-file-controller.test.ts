import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({ fromWebContents: vi.fn(), showOpenDialog: vi.fn() }));
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: electronMocks.fromWebContents },
  dialog: { showOpenDialog: electronMocks.showOpenDialog },
}));

import { InspectLocalFilesController } from "../src/main/controllers/local-file/inspect.local-file.controller";
import { SelectLocalFilesController } from "../src/main/controllers/local-file/select.local-file.controller";
import type { LocalFileService } from "../src/main/service/local-file.service";

const inspect = vi.fn<LocalFileService["inspect"]>();
const service = { inspect } as unknown as LocalFileService;
const selectController = new SelectLocalFilesController(service);
const inspectController = new InspectLocalFilesController(service);
const event = { sender: {} } as Electron.IpcMainInvokeEvent;

describe("local file controllers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects multiple files with a parent window and returns inspected metadata", async () => {
    const files = [{ path: "/tmp/a.md", name: "a.md", fileType: "MD" }];
    electronMocks.fromWebContents.mockReturnValue({});
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/a.md", "/tmp/b.txt"],
    });
    inspect.mockResolvedValue(files);

    await expect(selectController.run(event, {})).resolves.toEqual({
      code: 0,
      data: { files },
      msg: "ok",
    });
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ properties: ["openFile", "multiSelections"] }),
    );
    expect(inspect).toHaveBeenCalledWith(["/tmp/a.md", "/tmp/b.txt"]);
  });

  it("returns an empty list when selection is canceled", async () => {
    electronMocks.fromWebContents.mockReturnValue(null);
    electronMocks.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(selectController.run(event, {})).resolves.toEqual({
      code: 0,
      data: { files: [] },
      msg: "ok",
    });
    expect(inspect).not.toHaveBeenCalled();
  });

  it("validates pasted paths before inspection", async () => {
    expect((await inspectController.run(event, { paths: [] })).code).toBe(400);
    expect((await inspectController.run(event, { paths: [""] })).code).toBe(400);
    expect(inspect).not.toHaveBeenCalled();

    inspect.mockResolvedValue([{ path: "/tmp/a", name: "a", fileType: "文件" }]);
    await expect(inspectController.run(event, { paths: ["/tmp/a"] })).resolves.toMatchObject({
      code: 0,
      data: { files: [{ path: "/tmp/a" }] },
    });
  });
});
