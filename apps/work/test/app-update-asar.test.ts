import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPackage } from "@electron/asar";
import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: vi.fn(() => "/app"),
    getPath: vi.fn(() => "/user"),
    getVersion: vi.fn(() => "1.0.0"),
    isPackaged: true,
  },
  shell: { openExternal: vi.fn() },
}));

import { validateAsar } from "../src/main/service/app-update.service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function createUpdateAsar(version: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "willow-update-asar-"));
  temporaryDirectories.push(directory);
  const source = join(directory, "source");
  const requiredFiles = [
    ["package.json", JSON.stringify({ version })],
    [".vite/build/main.js", ""],
    [".vite/build/preload.js", ""],
    ["assets/icons/trayTemplate.png", ""],
    ["assets/icons/trayTemplate@2x.png", ""],
    ["src/main/db/migrations/meta/_journal.json", "{}"],
    ["resources/skills/example/SKILL.md", "# Example"],
  ] as const;
  await Promise.all(
    requiredFiles.map(async ([path, contents]) => {
      const destination = join(source, path);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, contents);
    }),
  );
  const archive = join(directory, "app.asar.part");
  await createPackage(source, archive);
  return archive;
}

describe("app update ASAR validation", () => {
  it("validates an archive without relying on its file extension", async () => {
    const archive = await createUpdateAsar("1.0.2");

    expect(() => validateAsar(archive, "1.0.2")).not.toThrow();
  });

  it("rejects an archive for a different version", async () => {
    const archive = await createUpdateAsar("1.0.2");

    expect(() => validateAsar(archive, "1.0.3")).toThrow("ASAR version mismatch");
  });
});
