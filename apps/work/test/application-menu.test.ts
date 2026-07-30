import { describe, expect, it } from "vitest";
import { createApplicationMenuTemplate } from "../src/main/application-menu";

describe("application menu", () => {
  it("keeps only functional native menus on macOS", () => {
    const template = createApplicationMenuTemplate("darwin");

    expect(template.map((item) => item.role)).toEqual([
      "appMenu",
      "editMenu",
      "viewMenu",
      "windowMenu",
    ]);
  });

  it("omits the macOS-only application menu on other platforms", () => {
    const template = createApplicationMenuTemplate("win32");

    expect(template.map((item) => item.role)).toEqual(["editMenu", "viewMenu", "windowMenu"]);
  });
});
