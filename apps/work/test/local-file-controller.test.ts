import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({ fromWebContents: vi.fn(), showOpenDialog: vi.fn() }));
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: electronMocks.fromWebContents },
  dialog: { showOpenDialog: electronMocks.showOpenDialog },
}));

import { InspectLocalFilesController } from "../src/main/controllers/local-file/inspect.local-file.controller";
import { PersistClipboardImagesController } from "../src/main/controllers/local-file/persist.clipboard-image.controller";
import { SelectLocalFilesController } from "../src/main/controllers/local-file/select.local-file.controller";
import type { LocalFileService } from "../src/main/service/local-file.service";

const inspect = vi.fn<LocalFileService["inspect"]>();
const persistClipboardImages = vi.fn<LocalFileService["persistClipboardImages"]>();
const service = { inspect, persistClipboardImages } as unknown as LocalFileService;
const selectController = new SelectLocalFilesController(service);
const inspectController = new InspectLocalFilesController(service);
const persistController = new PersistClipboardImagesController(service);
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

  it("selects multiple directories and returns inspected metadata", async () => {
    const files = [
      { path: "/tmp/project", name: "project", fileType: "文件夹", kind: "directory" as const },
    ];
    electronMocks.fromWebContents.mockReturnValue(null);
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/project"],
    });
    inspect.mockResolvedValue(files);

    await expect(selectController.run(event, { kind: "directory" })).resolves.toEqual({
      code: 0,
      data: { files },
      msg: "ok",
    });
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "选择本地文件夹",
        properties: ["openDirectory", "multiSelections"],
      }),
    );
    expect(inspect).toHaveBeenCalledWith(["/tmp/project"]);
  });

  it("rejects an invalid selection kind before opening the dialog", async () => {
    await expect(selectController.run(event, { kind: "invalid" as never })).resolves.toEqual({
      code: 400,
      msg: "kind must be file or directory",
    });
    expect(electronMocks.showOpenDialog).not.toHaveBeenCalled();
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

  it("persists valid clipboard image payloads", async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    const files = [
      { path: "/user/clipboard-images/id/image.png", name: "image.png", fileType: "PNG" },
    ];
    persistClipboardImages.mockResolvedValue(files);

    await expect(
      persistController.run(event, {
        images: [{ name: "image.png", mimeType: "image/png", data }],
      }),
    ).resolves.toEqual({ code: 0, data: { files }, msg: "ok" });
    expect(persistClipboardImages).toHaveBeenCalledWith([
      { name: "image.png", mimeType: "image/png", data },
    ]);
  });

  it("rejects invalid clipboard image payloads without persisting", async () => {
    expect((await persistController.run(event, { images: [] })).code).toBe(400);
    expect(
      (
        await persistController.run(event, {
          images: [{ name: "image.bmp", mimeType: "image/bmp", data: new ArrayBuffer(1) }],
        })
      ).code,
    ).toBe(400);
    expect(
      (
        await persistController.run(event, {
          images: [{ name: "image.png", mimeType: "image/png", data: new ArrayBuffer(0) }],
        })
      ).code,
    ).toBe(400);
    expect(
      (
        await persistController.run(event, {
          images: [
            {
              name: "large.png",
              mimeType: "image/png",
              data: new ArrayBuffer(25 * 1024 * 1024 + 1),
            },
          ],
        })
      ).code,
    ).toBe(400);
    expect(
      (
        await persistController.run(event, {
          images: Array.from({ length: 11 }, (_, index) => ({
            name: `image-${index}.png`,
            mimeType: "image/png",
            data: new ArrayBuffer(1),
          })),
        })
      ).code,
    ).toBe(400);
    expect(persistClipboardImages).not.toHaveBeenCalled();
  });
});
