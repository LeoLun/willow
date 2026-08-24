import { mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({ userDataPath: "" }));
vi.mock("electron", () => ({ app: { getPath: () => electronMocks.userDataPath } }));

import { LocalFileService } from "../src/main/service/local-file.service";

describe("LocalFileService", () => {
  let root: string;
  const service = new LocalFileService();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "willow-local-file-"));
    electronMocks.userDataPath = root;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("canonicalizes, describes, and deduplicates regular files", async () => {
    const file = join(root, "draft.md");
    const link = join(root, "draft-link.md");
    await writeFile(file, "draft");
    await symlink(file, link);

    await expect(service.inspect([link, file])).resolves.toEqual([
      { path: await realpath(file), name: "draft.md", fileType: "MD" },
    ]);
  });

  it("uses a generic type for extensionless files", async () => {
    const file = join(root, "LICENSE");
    await writeFile(file, "license");
    await expect(service.inspect([file])).resolves.toEqual([
      { path: await realpath(file), name: "LICENSE", fileType: "文件" },
    ]);
  });

  it("detects and loads supported images as pi-ai image content", async () => {
    const file = join(root, "preview.png");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(file, bytes);

    const [attachment] = await service.inspect([file]);
    expect(attachment).toEqual({
      path: await realpath(file),
      name: "preview.png",
      fileType: "PNG",
      mimeType: "image/png",
    });
    await expect(service.loadImages([attachment])).resolves.toEqual([
      {
        type: "image",
        data: bytes.toString("base64"),
        mimeType: "image/png",
        name: "preview.png",
        fileType: "PNG",
      },
    ]);
  });

  it("persists clipboard images under user data with safe names and private permissions", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    const [attachment] = await service.persistClipboardImages([
      {
        name: "../unsafe\\screen.jpeg",
        mimeType: "image/png",
        data: bytes.buffer,
      },
    ]);

    expect(attachment.name).toBe("screen.png");
    expect(attachment.path).toMatch(/clipboard-images\/[^/]+\/screen\.png$/);
    expect(attachment).toMatchObject({ fileType: "PNG", mimeType: "image/png" });
    await expect(readFile(attachment.path)).resolves.toEqual(Buffer.from(bytes));
    expect((await stat(attachment.path)).mode & 0o777).toBe(0o600);
    expect((await stat(join(attachment.path, ".."))).mode & 0o777).toBe(0o700);
  });

  it("uses unique directories for clipboard images with the same name", async () => {
    const images = await service.persistClipboardImages([
      { name: "image.png", mimeType: "image/png", data: new Uint8Array([1]).buffer },
      { name: "image.png", mimeType: "image/png", data: new Uint8Array([2]).buffer },
    ]);

    expect(images.map((image) => image.name)).toEqual(["image.png", "image.png"]);
    expect(images[0]?.path).not.toBe(images[1]?.path);
  });

  it("describes a pasted directory without inspecting its contents", async () => {
    const directory = join(root, "folder");
    const nested = join(directory, "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(join(directory, "a.md"), "a");
    await writeFile(join(nested, "b.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await expect(service.inspect([directory])).resolves.toEqual([
      {
        path: await realpath(directory),
        name: "folder",
        fileType: "文件夹",
        kind: "directory",
      },
    ]);
  });

  it("canonicalizes and deduplicates directory paths", async () => {
    const directory = join(root, "folder");
    const link = join(root, "folder-link");
    await mkdir(directory);
    await symlink(directory, link);

    await expect(service.inspect([link, directory])).resolves.toEqual([
      {
        path: await realpath(directory),
        name: "folder",
        fileType: "文件夹",
        kind: "directory",
      },
    ]);
  });

  it("attaches empty directories and rejects missing top-level paths", async () => {
    const directory = join(root, "empty");
    await mkdir(directory);
    await expect(service.inspect([directory])).resolves.toEqual([
      {
        path: await realpath(directory),
        name: "empty",
        fileType: "文件夹",
        kind: "directory",
      },
    ]);
    await expect(service.inspect([join(root, "missing.txt")])).rejects.toThrow();
  });
});
