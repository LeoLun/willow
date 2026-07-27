import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchFilesController } from "../src/main/controllers/file-search/search.file-search.controller";
import type { FileSearchService } from "../src/main/service/file-search.service";
import { WorkspaceNotFoundError } from "../src/main/service/workspace.service";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const searchFiles = vi.fn<FileSearchService["searchFiles"]>();
const service = { searchFiles } as unknown as FileSearchService;
const controller = new SearchFilesController(service);

describe("SearchFilesController", () => {
  beforeEach(() => {
    searchFiles.mockReset();
  });

  it("returns matching workspace files", async () => {
    const files = [{ name: "ChatBase.vue", relativePath: "src/ChatBase.vue" }];
    searchFiles.mockResolvedValueOnce(files);

    await expect(controller.run(event, { workspaceId: 7, query: "chat" })).resolves.toEqual({
      code: 0,
      data: { files },
      msg: "ok",
    });
    expect(searchFiles).toHaveBeenCalledWith(7, "chat");
  });

  it.each([
    [undefined, "workspaceId must be a positive integer"],
    [{}, "workspaceId must be a positive integer"],
    [{ workspaceId: 0, query: "" }, "workspaceId must be a positive integer"],
    [{ workspaceId: 1.5, query: "" }, "workspaceId must be a positive integer"],
    [{ workspaceId: 1 }, "query must be a string"],
    [{ workspaceId: 1, query: "a".repeat(201) }, "query must not exceed 200 characters"],
  ])("rejects invalid input without calling the service", async (request, message) => {
    await expect(controller.run(event, request as never)).resolves.toEqual({
      code: 400,
      msg: message,
    });
    expect(searchFiles).not.toHaveBeenCalled();
  });

  it("maps a missing workspace to 404", async () => {
    searchFiles.mockRejectedValueOnce(new WorkspaceNotFoundError(9));

    await expect(controller.run(event, { workspaceId: 9, query: "" })).resolves.toEqual({
      code: 404,
      msg: "Workspace not found",
    });
  });

  it("propagates file scanning failures", async () => {
    const error = new Error("file scan failed");
    searchFiles.mockRejectedValueOnce(error);

    await expect(controller.run(event, { workspaceId: 1, query: "" })).rejects.toBe(error);
  });
});
