import { describe, expect, it } from "vitest";
import { createMainWindowWebPreferences } from "../src/main/window/main-window-web-preferences";

describe("createMainWindowWebPreferences", () => {
  it("allows the Vite development renderer to embed file URLs", () => {
    expect(createMainWindowWebPreferences("/app/preload.js", "http://localhost:5173")).toEqual({
      preload: "/app/preload.js",
      webSecurity: false,
    });
  });

  it("keeps Electron web security enabled by default in packaged builds", () => {
    expect(createMainWindowWebPreferences("/app/preload.js")).toEqual({
      preload: "/app/preload.js",
    });
  });
});
