import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileSearchService } from "../src/main/service/file-search.service";
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

async function createFile(root: string, relativePath: string, content = ""): Promise<void> {
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
});
