import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { GetBoardPanelResponse } from "@shared/api";
import { Injectable } from "@willow/poetry";
import { WorkspaceService } from "./workspace.service";

const BOARD_PANEL_DIRECTORY = ".agents/panel";

export class InvalidBoardPanelPathError extends Error {
  constructor() {
    super("Board panel path escapes the workspace");
    this.name = "InvalidBoardPanelPathError";
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

      return { status: "ready", url: pathToFileURL(resolvedIndex).toString() };
    } catch (error) {
      if (isFileSystemError(error, "ENOENT") || isFileSystemError(error, "ENOTDIR")) {
        return { status: "missing" };
      }
      throw error;
    }
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
