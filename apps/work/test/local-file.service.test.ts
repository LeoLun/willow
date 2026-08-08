import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFileService } from "../src/main/service/local-file.service";

describe("LocalFileService", () => {
  let root: string;
  const service = new LocalFileService();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "willow-local-file-"));
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

  it("recursively attaches regular files inside pasted directories", async () => {
    const directory = join(root, "folder");
    const nested = join(directory, "nested");
    await mkdir(nested, { recursive: true });
    const markdown = join(directory, "a.md");
    const image = join(nested, "b.png");
    await writeFile(markdown, "a");
    await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await expect(service.inspect([directory])).resolves.toEqual(
      expect.arrayContaining([
        { path: await realpath(markdown), name: "a.md", fileType: "MD" },
        { path: await realpath(image), name: "b.png", fileType: "PNG", mimeType: "image/png" },
      ]),
    );
  });

  it("deduplicates files that appear both directly and inside a folder", async () => {
    const directory = join(root, "folder");
    await mkdir(directory);
    const file = join(directory, "draft.md");
    await writeFile(file, "draft");

    await expect(service.inspect([file, directory])).resolves.toEqual([
      { path: await realpath(file), name: "draft.md", fileType: "MD" },
    ]);
  });

  it("does not loop forever on symlink cycles inside a folder", async () => {
    const directory = join(root, "folder");
    await mkdir(directory);
    await writeFile(join(directory, "file.txt"), "content");
    await symlink(directory, join(directory, "loop"));

    await expect(service.inspect([directory])).resolves.toEqual([
      { path: await realpath(join(directory, "file.txt")), name: "file.txt", fileType: "TXT" },
    ]);
  });

  it("skips empty directories and rejects missing top-level paths", async () => {
    const directory = join(root, "empty");
    await mkdir(directory);
    await expect(service.inspect([directory])).resolves.toEqual([]);
    await expect(service.inspect([join(root, "missing.txt")])).rejects.toThrow();
  });
});
