import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FileSearchService,
  InvalidWorkspaceFilePathError,
  WorkspaceFileNotFoundError,
} from "../src/main/service/file-search.service";
import type { WorkspaceService } from "../src/main/service/workspace.service";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(prefix = "willow-file-search-"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function createService(workspacePath: string): FileSearchService {
  const workspaceService = {
    getWorkspaceDetail: vi.fn(() => ({ id: 1, path: workspacePath })),
  } as unknown as WorkspaceService;
  return new FileSearchService(workspaceService);
}

async function createFile(
  root: string,
  relativePath: string,
  content: string | Uint8Array = "",
): Promise<void> {
  const filePath = join(root, relativePath);
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("FileSearchService", () => {
  it("indexes workspace files while honoring ignores and skipping symbolic links", async () => {
    const root = await createTemporaryDirectory();
    const outside = await createTemporaryDirectory("willow-file-search-outside-");
    await createFile(root, ".gitignore", "dist/\n*.log\n");
    await createFile(root, "README.md");
    await createFile(root, "src/main.ts");
    await createFile(root, "src/nested/keep.ts");
    await createFile(root, "dist/bundle.js");
    await createFile(root, "debug.log");
    await createFile(root, "node_modules/package/index.js");
    await createFile(root, ".git/config");
    await createFile(outside, "secret.txt");
    await symlink(join(outside, "secret.txt"), join(root, "linked-secret.txt"));
    await symlink(outside, join(root, "linked-directory"));

    await expect(createService(root).searchFiles(1, "")).resolves.toEqual([
      { name: ".gitignore", relativePath: ".gitignore", type: "file" },
      { name: "README.md", relativePath: "README.md", type: "file" },
      { name: "main.ts", relativePath: "src/main.ts", type: "file" },
      { name: "keep.ts", relativePath: "src/nested/keep.ts", type: "file" },
    ]);

    await expect(createService(root).searchFiles(1, "src")).resolves.toEqual([
      { name: "src", relativePath: "src/", type: "directory" },
      { name: "main.ts", relativePath: "src/main.ts", type: "file" },
      { name: "nested", relativePath: "src/nested/", type: "directory" },
      { name: "keep.ts", relativePath: "src/nested/keep.ts", type: "file" },
    ]);
  });

  it("ranks exact, prefix, name, path, and ordered-subsequence matches", async () => {
    const root = await createTemporaryDirectory();
    await createFile(root, "ChatBase.vue");
    await createFile(root, "ChatBase.test.ts");
    await createFile(root, "notes/my-chatbase-notes.md");
    await createFile(root, "pages/main/Composer.vue");
    const service = createService(root);

    await expect(service.searchFiles(1, "chatbase.vue")).resolves.toEqual([
      { name: "ChatBase.vue", relativePath: "ChatBase.vue", type: "file" },
    ]);
    await expect(service.searchFiles(1, "chatbase")).resolves.toEqual([
      { name: "ChatBase.test.ts", relativePath: "ChatBase.test.ts", type: "file" },
      { name: "ChatBase.vue", relativePath: "ChatBase.vue", type: "file" },
      {
        name: "my-chatbase-notes.md",
        relativePath: "notes/my-chatbase-notes.md",
        type: "file",
      },
    ]);
    await expect(service.searchFiles(1, "pages/main")).resolves.toEqual([
      { name: "main", relativePath: "pages/main/", type: "directory" },
      { name: "Composer.vue", relativePath: "pages/main/Composer.vue", type: "file" },
    ]);
    await expect(service.searchFiles(1, "cmpsrv")).resolves.toEqual([
      { name: "Composer.vue", relativePath: "pages/main/Composer.vue", type: "file" },
    ]);
  });

  it("limits results and refreshes the per-workspace cache after five seconds", async () => {
    const root = await createTemporaryDirectory();
    for (let index = 0; index < 55; index += 1) {
      await createFile(root, `files/${String(index).padStart(2, "0")}.txt`);
    }
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const service = createService(root);

    await expect(service.searchFiles(1, "")).resolves.toHaveLength(50);
    await createFile(root, "fresh.txt");

    now.mockReturnValue(5_999);
    await expect(service.searchFiles(1, "fresh")).resolves.toEqual([]);

    now.mockReturnValue(6_001);
    await expect(service.searchFiles(1, "fresh")).resolves.toEqual([
      { name: "fresh.txt", relativePath: "fresh.txt", type: "file" },
    ]);
  });

  it("shares an active scan between concurrent searches", async () => {
    const root = await createTemporaryDirectory();
    await createFile(root, "src/main.ts");
    const service = createService(root);

    const [allFiles, matchingFiles] = await Promise.all([
      service.searchFiles(1, ""),
      service.searchFiles(1, "main"),
    ]);

    expect(allFiles).toEqual([{ name: "main.ts", relativePath: "src/main.ts", type: "file" }]);
    expect(matchingFiles).toEqual([{ name: "main.ts", relativePath: "src/main.ts", type: "file" }]);
  });

  it("lists direct children with directory-first cursor pagination", async () => {
    const root = await createTemporaryDirectory();
    await createFile(root, ".gitignore", "ignored/\n*.log\n");
    await createFile(root, "z-file.txt");
    await createFile(root, "a-directory/nested.txt");
    await createFile(root, "b-directory/child.txt");
    await createFile(root, "ignored/secret.txt");
    await createFile(root, "debug.log");
    const service = createService(root);

    const first = await service.listDirectory(1, "", undefined, 2);
    expect(first.entries).toEqual([
      { name: "a-directory", relativePath: "a-directory/", type: "directory" },
      { name: "b-directory", relativePath: "b-directory/", type: "directory" },
    ]);
    expect(first.nextCursor).toBeTypeOf("string");

    await expect(service.listDirectory(1, "", first.nextCursor, 2)).resolves.toEqual({
      entries: [
        { name: ".gitignore", relativePath: ".gitignore", type: "file" },
        { name: "z-file.txt", relativePath: "z-file.txt", type: "file" },
      ],
    });
    await expect(service.listDirectory(1, "a-directory")).resolves.toEqual({
      entries: [{ name: "nested.txt", relativePath: "a-directory/nested.txt", type: "file" }],
    });
  });

  it("validates directory cursors and keeps requested paths inside the workspace", async () => {
    const root = await createTemporaryDirectory();
    const outside = await createTemporaryDirectory("willow-file-search-outside-");
    await createFile(root, "inside.txt");
    await createFile(outside, "secret.txt");
    await symlink(outside, join(root, "linked-directory"));
    const service = createService(root);

    await expect(service.listDirectory(1, "../")).rejects.toBeInstanceOf(
      InvalidWorkspaceFilePathError,
    );
    await expect(service.listDirectory(1, "", "invalid-cursor")).rejects.toBeInstanceOf(
      InvalidWorkspaceFilePathError,
    );
    await expect(
      service.readWorkspaceFile(1, "linked-directory/secret.txt"),
    ).rejects.toBeInstanceOf(InvalidWorkspaceFilePathError);
  });

  it("reads UTF-8 text and classifies binary, oversized, empty, and missing files", async () => {
    const root = await createTemporaryDirectory();
    await createFile(root, "notes.txt", "你好 Willow");
    await createFile(root, "empty.unknown");
    await createFile(root, "binary.dat", new Uint8Array([1, 0, 2]));
    await createFile(root, "large.txt", "x".repeat(1024 * 1024 + 1));
    const service = createService(root);

    await expect(service.readWorkspaceFile(1, "notes.txt")).resolves.toMatchObject({
      content: "你好 Willow",
      name: "notes.txt",
      relativePath: "notes.txt",
      status: "ready",
    });
    await expect(service.readWorkspaceFile(1, "empty.unknown")).resolves.toMatchObject({
      content: "",
      status: "ready",
    });
    await expect(service.readWorkspaceFile(1, "binary.dat")).resolves.toMatchObject({
      status: "binary",
    });
    await expect(service.readWorkspaceFile(1, "large.txt")).resolves.toMatchObject({
      status: "too-large",
    });
    await expect(service.readWorkspaceFile(1, "missing.txt")).rejects.toBeInstanceOf(
      WorkspaceFileNotFoundError,
    );
  });

  it("resolves only existing files inside the workspace for external opening", async () => {
    const root = await createTemporaryDirectory();
    const outside = await createTemporaryDirectory("willow-file-search-outside-");
    await createFile(root, "inside.dat", new Uint8Array([1, 0, 2]));
    await createFile(outside, "secret.dat");
    await symlink(join(outside, "secret.dat"), join(root, "linked-secret.dat"));
    const service = createService(root);

    await expect(service.resolveWorkspaceFilePath(1, "inside.dat")).resolves.toBe(
      await realpath(join(root, "inside.dat")),
    );
    await expect(service.resolveWorkspaceFilePath(1, "linked-secret.dat")).rejects.toBeInstanceOf(
      InvalidWorkspaceFilePathError,
    );
    await expect(service.resolveWorkspaceFilePath(1, "missing.dat")).rejects.toBeInstanceOf(
      WorkspaceFileNotFoundError,
    );
  });

  it("resolves existing files and directories inside the workspace for revealing", async () => {
    const root = await createTemporaryDirectory();
    const outside = await createTemporaryDirectory("willow-file-search-outside-");
    await createFile(root, "src/main.ts");
    await createFile(outside, "secret.txt");
    await symlink(outside, join(root, "linked-directory"));
    const service = createService(root);

    await expect(service.resolveWorkspaceEntryPath(1, "src/main.ts")).resolves.toBe(
      await realpath(join(root, "src/main.ts")),
    );
    await expect(service.resolveWorkspaceEntryPath(1, "src")).resolves.toBe(
      await realpath(join(root, "src")),
    );
    await expect(service.resolveWorkspaceEntryPath(1, "linked-directory")).rejects.toBeInstanceOf(
      InvalidWorkspaceFilePathError,
    );
    await expect(service.resolveWorkspaceEntryPath(1, "missing")).rejects.toBeInstanceOf(
      WorkspaceFileNotFoundError,
    );
  });

  it("invalidates the search and ignore caches immediately", async () => {
    const root = await createTemporaryDirectory();
    await createFile(root, "before.txt");
    const service = createService(root);

    await expect(service.searchFiles(1, "fresh")).resolves.toEqual([]);
    await createFile(root, "fresh.txt");
    service.invalidateWorkspace(1);

    await expect(service.searchFiles(1, "fresh")).resolves.toEqual([
      { name: "fresh.txt", relativePath: "fresh.txt", type: "file" },
    ]);
  });
});
