import "reflect-metadata";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GetBoardPanelController } from "../src/main/controllers/board/get.board.controller";
import { SetBoardEditModeController } from "../src/main/controllers/board/set-edit-mode.board.controller";
import {
  BoardPanelFrameNotFoundError,
  BoardPanelService,
  InvalidBoardPanelPathError,
} from "../src/main/service/board-panel.service";
import type { WorkspaceService } from "../src/main/service/workspace.service";

const temporaryDirectories: string[] = [];

async function createWorkspace(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "willow-board-panel-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createService(workspacePath: string): BoardPanelService {
  const workspaceService = {
    getWorkspaceDetail: vi.fn(() => ({ id: 1, path: workspacePath })),
  } as unknown as WorkspaceService;
  return new BoardPanelService(workspaceService);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("BoardPanelService", () => {
  it("returns missing when the board entry does not exist", async () => {
    const workspace = await createWorkspace();

    await expect(createService(workspace).getBoardPanel(1)).resolves.toEqual({
      status: "missing",
    });
  });

  it("returns a portable file URL for a ready multi-file board", async () => {
    const workspace = await createWorkspace();
    const panel = join(workspace, ".agents/panel");
    await mkdir(panel, { recursive: true });
    await writeFile(join(panel, "index.html"), '<link rel="stylesheet" href="styles.css">');
    await writeFile(join(panel, "styles.css"), "body { color: red; }");

    const response = await createService(workspace).getBoardPanel(1);
    const indexUrl = pathToFileURL(await realpath(join(panel, "index.html"))).toString();
    expect(response).toEqual({
      status: "ready",
      url: indexUrl,
    });
    expect(new URL("styles.css", indexUrl).toString()).toBe(
      pathToFileURL(await realpath(join(panel, "styles.css"))).toString(),
    );
  });

  it("rejects a panel directory symlink that escapes the workspace", async () => {
    const workspace = await createWorkspace();
    const outside = await createWorkspace();
    await mkdir(join(workspace, ".agents"), { recursive: true });
    await writeFile(join(outside, "index.html"), "outside");
    await symlink(outside, join(workspace, ".agents/panel"));

    await expect(createService(workspace).getBoardPanel(1)).rejects.toBeInstanceOf(
      InvalidBoardPanelPathError,
    );
  });

  it("rejects an index file symlink that escapes the panel root", async () => {
    const workspace = await createWorkspace();
    const outside = await createWorkspace();
    const panel = join(workspace, ".agents/panel");
    await mkdir(panel, { recursive: true });
    await writeFile(join(outside, "index.html"), "outside");
    await symlink(join(outside, "index.html"), join(panel, "index.html"));

    await expect(createService(workspace).getBoardPanel(1)).rejects.toBeInstanceOf(
      InvalidBoardPanelPathError,
    );
  });

  it("injects and removes the editor bridge only in the matching board frame", async () => {
    const workspace = await createWorkspace();
    const panel = join(workspace, ".agents/panel");
    await mkdir(panel, { recursive: true });
    await writeFile(join(panel, "index.html"), "<main>Board</main>");
    const panelUrl = pathToFileURL(await realpath(join(panel, "index.html"))).toString();
    const executeJavaScript = vi.fn(async () => undefined);
    const matchingFrame = {
      executeJavaScript,
      isDestroyed: () => false,
      url: `${panelUrl}?v=1&willow-board-tab=board-tab`,
    };
    const webContents = {
      mainFrame: {
        framesInSubtree: [
          { ...matchingFrame, url: `${panelUrl}?v=1&willow-board-tab=another-tab` },
          matchingFrame,
        ],
      },
    } as unknown as Electron.WebContents;
    const service = createService(workspace);

    await service.setEditMode(webContents, 1, "board-tab", true);
    await service.setEditMode(webContents, 1, "board-tab", false);

    expect(executeJavaScript).toHaveBeenCalledTimes(2);
    expect(executeJavaScript.mock.calls[0]?.[0]).toContain('("board-tab", true)');
    expect(executeJavaScript.mock.calls[1]?.[0]).toContain('("board-tab", false)');
  });

  it("fails safely when the requested board frame is unavailable", async () => {
    const workspace = await createWorkspace();
    const panel = join(workspace, ".agents/panel");
    await mkdir(panel, { recursive: true });
    await writeFile(join(panel, "index.html"), "<main>Board</main>");
    const webContents = {
      mainFrame: { framesInSubtree: [] },
    } as unknown as Electron.WebContents;

    await expect(
      createService(workspace).setEditMode(webContents, 1, "board-tab", true),
    ).rejects.toBeInstanceOf(BoardPanelFrameNotFoundError);
  });
});

describe("GetBoardPanelController", () => {
  it("rejects invalid workspace ids without calling the service", async () => {
    const getBoardPanel = vi.fn();
    const controller = new GetBoardPanelController({ getBoardPanel } as never);

    await expect(controller.run({} as never, { workspaceId: 0 })).resolves.toMatchObject({
      code: 400,
    });
    expect(getBoardPanel).not.toHaveBeenCalled();
  });
});

describe("SetBoardEditModeController", () => {
  it("validates requests before injecting into a frame", async () => {
    const setEditMode = vi.fn();
    const controller = new SetBoardEditModeController({ setEditMode } as never);

    await expect(
      controller.run({ sender: {} } as never, { enabled: true, tabId: "", workspaceId: 1 }),
    ).resolves.toMatchObject({ code: 400 });
    expect(setEditMode).not.toHaveBeenCalled();
  });

  it("passes the invoking web contents to the board service", async () => {
    const setEditMode = vi.fn(async () => undefined);
    const controller = new SetBoardEditModeController({ setEditMode } as never);
    const sender = {} as Electron.WebContents;

    await expect(
      controller.run({ sender } as never, { enabled: true, tabId: "board-tab", workspaceId: 1 }),
    ).resolves.toEqual({ code: 0, data: { enabled: true }, msg: "ok" });
    expect(setEditMode).toHaveBeenCalledWith(sender, 1, "board-tab", true);
  });
});
