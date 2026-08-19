import "reflect-metadata";
import { mkdtemp, mkdir, open, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadPlanFileController } from "../src/main/controllers/plan-file/read.plan-file.controller";
import {
  InvalidPlanFilePathError,
  PlanFileNotFoundError,
  PlanFileService,
} from "../src/main/service/plan-file.service";

class TestPlanFileService extends PlanFileService {
  constructor(private readonly root: string) {
    super();
  }

  protected override planDirectory(): string {
    return this.root;
  }
}

describe("PlanFileService", () => {
  let root: string;
  let service: TestPlanFileService;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "willow-plan-file-")));
    service = new TestPlanFileService(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads markdown plan content with metadata", async () => {
    const file = join(root, "2026-08-13-foo.md");
    await writeFile(file, "line1\nline2\n");

    await expect(service.readPlanFile(file)).resolves.toEqual({
      content: "line1\nline2\n",
      name: "2026-08-13-foo.md",
      path: await realpath(file),
      byteCount: 12,
      lineCount: 2,
      status: "ready",
    });
  });

  it("rejects missing files with a not-found error", async () => {
    await expect(service.readPlanFile(join(root, "missing.md"))).rejects.toBeInstanceOf(
      PlanFileNotFoundError,
    );
  });

  it("rejects non-markdown, relative, and out-of-directory paths", async () => {
    const text = join(root, "notes.txt");
    await writeFile(text, "text");

    await expect(service.readPlanFile(text)).rejects.toBeInstanceOf(InvalidPlanFilePathError);
    await expect(service.readPlanFile("relative.md")).rejects.toBeInstanceOf(
      InvalidPlanFilePathError,
    );

    const outside = join(tmpdir(), "outside.md");
    await writeFile(outside, "outside");
    await expect(service.readPlanFile(outside)).rejects.toBeInstanceOf(InvalidPlanFilePathError);
    await rm(outside, { force: true });
  });

  it("rejects symlinks that escape the plan directory", async () => {
    const target = join(root, "target.md");
    const outside = join(tmpdir(), "outside-escape.md");
    await writeFile(outside, "outside");
    await symlink(outside, target);

    await expect(service.readPlanFile(target)).rejects.toBeInstanceOf(InvalidPlanFilePathError);
    await rm(outside, { force: true });
  });

  it("marks oversized files as too-large", async () => {
    const file = join(root, "huge.md");
    const handle = await open(file, "w");
    await handle.truncate(4 * 1024 * 1024 + 1);
    await handle.close();

    await expect(service.readPlanFile(file)).resolves.toMatchObject({ status: "too-large" });
  });

  it("marks binary files as binary", async () => {
    const file = join(root, "binary.md");
    await writeFile(file, Buffer.from([0x61, 0x00, 0x62]));

    await expect(service.readPlanFile(file)).resolves.toMatchObject({ status: "binary" });
  });

  it("rejects directories", async () => {
    const directory = join(root, "plan.md");
    await mkdir(directory);

    await expect(service.readPlanFile(directory)).rejects.toBeInstanceOf(InvalidPlanFilePathError);
  });
});

describe("ReadPlanFileController", () => {
  const readPlanFile = vi.fn<PlanFileService["readPlanFile"]>();
  const service = { readPlanFile } as unknown as PlanFileService;
  const controller = new ReadPlanFileController(service);
  const event = { sender: {} } as Electron.IpcMainInvokeEvent;

  beforeEach(() => vi.clearAllMocks());

  it("returns the file content on success", async () => {
    const file = {
      content: "# Plan",
      name: "p.md",
      path: "/p/p.md",
      byteCount: 6,
      lineCount: 1,
      status: "ready" as const,
    };
    readPlanFile.mockResolvedValue(file);

    await expect(controller.run(event, { path: "/p/p.md" })).resolves.toEqual({
      code: 0,
      data: { file },
      msg: "ok",
    });
    expect(readPlanFile).toHaveBeenCalledWith("/p/p.md");
  });

  it("rejects invalid input without calling the service", async () => {
    expect((await controller.run(event, { path: "" })).code).toBe(400);
    expect((await controller.run(event, { path: "   " })).code).toBe(400);
    expect((await controller.run(event, { path: "a".repeat(5000) })).code).toBe(400);
    expect(readPlanFile).not.toHaveBeenCalled();
  });

  it("maps not-found and invalid-path errors to 404 and 400", async () => {
    readPlanFile.mockRejectedValue(new PlanFileNotFoundError("/p/missing.md"));
    expect((await controller.run(event, { path: "/p/missing.md" })).code).toBe(404);

    readPlanFile.mockRejectedValue(new InvalidPlanFilePathError("/etc/passwd"));
    expect((await controller.run(event, { path: "/etc/passwd" })).code).toBe(400);
  });

  it("propagates unexpected service failures", async () => {
    readPlanFile.mockRejectedValue(new Error("boom"));
    await expect(controller.run(event, { path: "/p/p.md" })).rejects.toThrow("boom");
  });
});
