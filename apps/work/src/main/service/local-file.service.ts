import { readFile, realpath, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
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

@Injectable()
export class LocalFileService {
  async inspect(paths: readonly string[]): Promise<LocalFileAttachment[]> {
    const files: LocalFileAttachment[] = [];
    const seen = new Set<string>();

    for (const path of paths) {
      const canonicalPath = await realpath(path);
      const details = await stat(canonicalPath);
      if (!details.isFile()) throw new Error(`Local attachment must be a regular file: ${path}`);
      if (seen.has(canonicalPath)) continue;

      seen.add(canonicalPath);
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
