import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { ImageContent } from "@earendil-works/pi-ai";
import type { ClipboardImagePayload, LocalFileAttachment } from "@shared/api";
import { isImageAttachment } from "@shared/local-file";
import { Injectable } from "@willow/poetry";
import { app } from "electron";

const IMAGE_MIME_TYPES = new Map<string, string>([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const CLIPBOARD_IMAGE_EXTENSIONS = new Map<string, string>([
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const CLIPBOARD_IMAGE_DIRECTORY = "clipboard-images";

@Injectable()
export class LocalFileService {
  async persistClipboardImages(
    images: readonly ClipboardImagePayload[],
  ): Promise<LocalFileAttachment[]> {
    const root = join(app.getPath("userData"), CLIPBOARD_IMAGE_DIRECTORY);
    await mkdir(root, { recursive: true, mode: 0o700 });

    return await Promise.all(
      images.map(async (image) => {
        const directory = join(root, randomUUID());
        await mkdir(directory, { mode: 0o700 });
        const path = join(directory, this.clipboardImageName(image.name, image.mimeType));

        try {
          await writeFile(path, new Uint8Array(image.data), { flag: "wx", mode: 0o600 });
          const [file] = await this.inspect([path]);
          if (!file) throw new Error("Failed to inspect persisted clipboard image");
          return file;
        } catch (error) {
          await rm(directory, { recursive: true, force: true });
          throw error;
        }
      }),
    );
  }

  async inspect(paths: readonly string[]): Promise<LocalFileAttachment[]> {
    const files: LocalFileAttachment[] = [];
    const seenPaths = new Set<string>();

    for (const path of paths) {
      const canonicalPath = await realpath(path);
      if (seenPaths.has(canonicalPath)) continue;

      const details = await stat(canonicalPath);
      if (details.isDirectory()) {
        seenPaths.add(canonicalPath);
        files.push({
          path: canonicalPath,
          name: basename(canonicalPath) || canonicalPath,
          fileType: "文件夹",
          kind: "directory",
        });
        continue;
      }
      // Only regular files and directories become attachments; sockets, FIFOs, devices, etc. are skipped.
      if (!details.isFile()) continue;

      seenPaths.add(canonicalPath);
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

  private clipboardImageName(name: string, mimeType: string): string {
    const extension = CLIPBOARD_IMAGE_EXTENSIONS.get(mimeType);
    if (!extension) throw new Error(`Unsupported clipboard image type: ${mimeType}`);

    const leaf = basename(name.replaceAll("\\", "/"));
    const stem = [...leaf.replace(/\.[^.]*$/, "").replace(/[<>:"/\\|?*]/g, "_")]
      .map((character) => (character.charCodeAt(0) < 32 ? "_" : character))
      .join("")
      .trim();
    return `${stem || "image"}.${extension}`;
  }
}
