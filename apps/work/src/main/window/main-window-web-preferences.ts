import type { WebPreferences } from "electron";

export function createMainWindowWebPreferences(
  preload: string,
  devServerUrl?: string,
): WebPreferences {
  return {
    preload,
    // The Vite renderer is served over http://localhost in development. Chromium otherwise
    // rejects the board iframe's file:// URL before it can load. Packaged builds remain on
    // Electron's secure default because their renderer is also loaded from file://.
    ...(devServerUrl ? { webSecurity: false } : {}),
  };
}
