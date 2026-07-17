import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  nativeTheme: { themeSource: "system" },
}));

vi.mock("electron", () => ({
  nativeTheme: electronMocks.nativeTheme,
}));

import { SetThemeController } from "../src/main/controllers/theme/set.theme.controller";
import type { SetThemeRequest, ThemeMode } from "../src/shared/api";

describe("SetThemeController", () => {
  const event = undefined as unknown as Electron.IpcMainInvokeEvent;

  beforeEach(() => {
    electronMocks.nativeTheme.themeSource = "system";
  });

  it.each<ThemeMode>(["system", "light", "dark"])(
    "sets the native theme source to %s",
    async (mode) => {
      const controller = new SetThemeController();

      await expect(controller.run(event, { mode })).resolves.toEqual({
        code: 0,
        data: {},
        msg: "ok",
      });
      expect(electronMocks.nativeTheme.themeSource).toBe(mode);
    },
  );

  it.each([
    ["a missing request", undefined],
    ["a non-object request", "light"],
    ["an unsupported mode", { mode: "sepia" }],
  ])("rejects %s without changing the native theme", async (_label, request) => {
    const controller = new SetThemeController();
    electronMocks.nativeTheme.themeSource = "dark";

    const response = await controller.run(event, request as unknown as SetThemeRequest);

    expect(response.code).toBe(400);
    expect(response.data).toBeUndefined();
    expect(electronMocks.nativeTheme.themeSource).toBe("dark");
  });
});
