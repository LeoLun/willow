import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { ImageContent } from "@earendil-works/pi-ai";
import type { LocalFileAttachment } from "@shared/api";
import { isImageAttachment } from "@shared/local-file";
import { Injectable } from "@willow/poetry";

const IMAGE_MIME_TYPES = new Map<string, string>([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

@Injectable()
export class LocalFileService {
  async inspect(paths: readonly string[]): Promise<LocalFileAttachment[]> {
    const files: LocalFileAttachment[] = [];
    const seenFiles = new Set<string>();
    const seenDirectories = new Set<string>();

    const collect = async (path: string): Promise<void> => {
      const canonicalPath = await realpath(path);
      const details = await stat(canonicalPath);
      if (details.isDirectory()) {
        // Walk pasted folders recursively; realpath keeps symlink loops from
        // re-entering an already visited directory.
        if (seenDirectories.has(canonicalPath)) return;
        seenDirectories.add(canonicalPath);
        const entries = await readdir(canonicalPath, { withFileTypes: true });
        for (const entry of entries) {
          try {
            await collect(join(canonicalPath, entry.name));
          } catch (error) {
            // Skip dangling symlinks and other vanished entries inside a folder;
            // a single broken entry must not fail the whole paste.
            if (!isFileSystemError(error, "ENOENT")) throw error;
          }
        }
        return;
      }
      // Only regular files become attachments; sockets, FIFOs, devices, etc. are skipped.
      if (!details.isFile() || seenFiles.has(canonicalPath)) return;

      seenFiles.add(canonicalPath);
      const name = basename(canonicalPath);
      const suffix = extname(name).toLowerCase();
      const extension = suffix.slice(1).trim();
      const mimeType = IMAGE_MIME_TYPES.get(suffix);
      files.push({
        path: canonicalPath,
        name,
        fileType: extension ? extension.toUpperCase() : "文件",
        ...(mimeType ? { mimeType } : {}),
      });
    };

    for (const path of paths) {
      await collect(path);
    }

    return files;
  }

  async loadImages(files: readonly LocalFileAttachment[]): Promise<ImageContent[]> {
    return await Promise.all(
      files.filter(isImageAttachment).map(async (file) => ({
        type: "image" as const,
        data: (await readFile(file.path)).toString("base64"),
        mimeType: file.mimeType,
        name: file.name,
        fileType: file.fileType,
      })),
    );
  }
}
