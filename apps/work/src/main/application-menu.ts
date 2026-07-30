import { app, Menu, type MenuItemConstructorOptions } from "electron";

const APPLICATION_NAME = "Willow";

export function createApplicationMenuTemplate(
  platform: NodeJS.Platform = process.platform,
): MenuItemConstructorOptions[] {
  return [
    ...(platform === "darwin"
      ? ([{ role: "appMenu" }] satisfies MenuItemConstructorOptions[])
      : []),
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
}

export function configureApplicationMenu() {
  app.setName(APPLICATION_NAME);
  Menu.setApplicationMenu(Menu.buildFromTemplate(createApplicationMenuTemplate()));
}
