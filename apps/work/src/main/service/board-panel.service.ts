import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { GetBoardPanelResponse } from "@shared/api";
import { Injectable } from "@willow/poetry";
import type { WebContents, WebFrameMain } from "electron";
import { createBoardEditorBridgeScript } from "./board-editor-bridge";
import { WorkspaceService } from "./workspace.service";

const BOARD_PANEL_DIRECTORY = ".agents/panel";

export class InvalidBoardPanelPathError extends Error {
  constructor() {
    super("Board panel path escapes the workspace");
    this.name = "InvalidBoardPanelPathError";
  }
}

export class BoardPanelFrameNotFoundError extends Error {
  constructor() {
    super("Board panel frame is not ready");
    this.name = "BoardPanelFrameNotFoundError";
  }
}

@Injectable()
export class BoardPanelService {
  constructor(private readonly workspaceService: WorkspaceService) {}

  async getBoardPanel(workspaceId: number): Promise<GetBoardPanelResponse> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const workspaceRoot = await realpath(workspace.path);
    const panelRootPath = resolve(workspaceRoot, BOARD_PANEL_DIRECTORY);
    const indexPath = resolve(panelRootPath, "index.html");

    try {
      const [panelRoot, resolvedIndex, indexStats] = await Promise.all([
        realpath(panelRootPath),
        realpath(indexPath),
        stat(indexPath),
      ]);
      if (
        !indexStats.isFile() ||
        !isPathInside(panelRoot, workspaceRoot) ||
        !isPathInside(resolvedIndex, panelRoot)
      ) {
        throw new InvalidBoardPanelPathError();
      }

      return {
        status: "ready",
        url: pathToFileURL(resolvedIndex).toString(),
      };
    } catch (error) {
      if (isFileSystemError(error, "ENOENT") || isFileSystemError(error, "ENOTDIR")) {
        return { status: "missing" };
      }
      throw error;
    }
  }

  async setEditMode(
    webContents: WebContents,
    workspaceId: number,
    tabId: string,
    enabled: boolean,
  ): Promise<void> {
    const panel = await this.getBoardPanel(workspaceId);
    if (panel.status !== "ready") throw new BoardPanelFrameNotFoundError();
    const frame = webContents.mainFrame.framesInSubtree.find((candidate) =>
      isMatchingBoardFrame(candidate, panel.url, tabId),
    );
    if (!frame || frame.isDestroyed()) throw new BoardPanelFrameNotFoundError();
    await frame.executeJavaScript(createBoardEditorBridgeScript(tabId, enabled));
  }
}

function isMatchingBoardFrame(frame: WebFrameMain, panelUrl: string, tabId: string): boolean {
  try {
    const candidate = new URL(frame.url);
    const panel = new URL(panelUrl);
    return (
      candidate.protocol === panel.protocol &&
      candidate.host === panel.host &&
      candidate.pathname === panel.pathname &&
      candidate.searchParams.get("willow-board-tab") === tabId
    );
  } catch {
    return false;
  }
}

function isPathInside(path: string, directory: string): boolean {
  const pathFromDirectory = relative(resolve(directory), resolve(path));
  return (
    pathFromDirectory === "" ||
    (!pathFromDirectory.startsWith(`..${sep}`) &&
      pathFromDirectory !== ".." &&
      !isAbsolute(pathFromDirectory))
  );
}

function isFileSystemError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
