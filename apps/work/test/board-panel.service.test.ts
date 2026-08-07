import "reflect-metadata";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GetBoardPanelController } from "../src/main/controllers/board/get.board.controller";
import {
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
