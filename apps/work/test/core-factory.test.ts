import { CoreFactoryStatic, Injectable, IPC, Module } from "@willow/poetry";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  app: { on: vi.fn() },
  ipcMain: electronMocks,
  shell: { openExternal: vi.fn() },
}));

@Injectable()
class CatalogController {
  @IPC("GET_TEST_CATALOG")
  getCatalog() {
    return [];
  }
}

@Module({ controllers: [CatalogController] })
class TestModule {}

describe("CoreFactoryStatic", () => {
  beforeEach(() => {
    electronMocks.handle.mockClear();
  });

  it("activates controllers declared by a module without requiring constructor injection", async () => {
    await new CoreFactoryStatic().create(TestModule);

    expect(electronMocks.handle).toHaveBeenCalledWith("GET_TEST_CATALOG", expect.any(Function));
  });
});
