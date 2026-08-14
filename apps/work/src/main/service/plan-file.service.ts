import { readFile, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import type { PlanFileContent } from "@shared/api";
import { resolvePlanDirectory } from "@willow/core";
import { Injectable } from "@willow/poetry";

const MAX_PLAN_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PLAN_PATH_LENGTH = 4_096;

export class PlanFileNotFoundError extends Error {
  constructor(path: string) {
    super(`Plan file not found: ${path}`);
    this.name = "PlanFileNotFoundError";
  }
}

export class InvalidPlanFilePathError extends Error {
  constructor(path: string) {
    super(`Invalid plan file path: ${path}`);
    this.name = "InvalidPlanFilePathError";
  }
}

@Injectable()
export class PlanFileService {
  protected planDirectory(): string {
    return resolve(resolvePlanDirectory());
  }

  async readPlanFile(path: string): Promise<PlanFileContent> {
    if (
      !isAbsolute(path) ||
      path.length > MAX_PLAN_PATH_LENGTH ||
      !path.toLowerCase().endsWith(".md")
    ) {
      throw new InvalidPlanFilePathError(path);
    }

    const canonicalPath = await this.resolvePlanFilePath(path);
    const details = await stat(canonicalPath);
    if (!details.isFile()) throw new InvalidPlanFilePathError(path);

    const metadata = {
      content: "",
      name: basename(canonicalPath),
      path: canonicalPath,
      byteCount: 0,
      lineCount: 0,
    };

    if (details.size > MAX_PLAN_FILE_BYTES) {
      return { ...metadata, status: "too-large" };
    }

    const bytes = await readFile(canonicalPath);
    if (bytes.includes(0)) return { ...metadata, status: "binary" };

    try {
      const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return {
        ...metadata,
        content,
        byteCount: Buffer.byteLength(content),
        lineCount: countLines(content),
        status: "ready",
      };
    } catch {
      return { ...metadata, status: "binary" };
    }
  }

  private async resolvePlanFilePath(path: string): Promise<string> {
    let canonicalPath: string;
    try {
      canonicalPath = await realpath(path);
    } catch (error) {
      if (isFileSystemError(error, "ENOENT")) throw new PlanFileNotFoundError(path);
      throw error;
    }
    if (!isPathInside(this.planDirectory(), canonicalPath)) {
      throw new InvalidPlanFilePathError(path);
    }
    return canonicalPath;
  }
}

function countLines(content: string): number {
  if (content === "") return 0;
  const lines = content.split(/\r\n|\n|\r/);
  return lines.length - (lines[lines.length - 1] === "" ? 1 : 0);
}

function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function isPathInside(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
