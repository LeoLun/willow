import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import {
  readUpdateStore,
  restoreDatabaseBackup,
  type StoredUpdate,
  writeUpdateStore,
} from "./update-store";

const RUNTIME_CONTEXT_KEY = Symbol.for("willow.hot-update.runtime");

export interface HotUpdateRuntimeContext {
  currentVersion: string;
  selected?: StoredUpdate;
  pending: boolean;
  payload: boolean;
}

export function getHotUpdateRuntimeContext(): HotUpdateRuntimeContext | undefined {
  return (globalThis as Record<symbol, unknown>)[RUNTIME_CONTEXT_KEY] as
    | HotUpdateRuntimeContext
    | undefined;
}

export function getEffectiveAppPath(): string {
  return getHotUpdateRuntimeContext()?.selected?.asarPath ?? app.getAppPath();
}

export function selectHotUpdatePayload(userDataPath: string): StoredUpdate | undefined {
  const store = readUpdateStore(userDataPath);

  if (store.pending) {
    if (store.pending.launchAttempted) {
      restoreDatabaseBackup(userDataPath, store.databaseBackupPath);
      const rolledBack = { active: store.active };
      writeUpdateStore(userDataPath, rolledBack);
      return store.active && existsSync(store.active.asarPath) ? store.active : undefined;
    }

    store.pending.launchAttempted = true;
    writeUpdateStore(userDataPath, store);
    return existsSync(store.pending.asarPath) ? store.pending : undefined;
  }

  return store.active && existsSync(store.active.asarPath) ? store.active : undefined;
}

export function prepareHotUpdateLaunch(userDataPath: string): string | undefined {
  const existing = getHotUpdateRuntimeContext();
  if (existing?.payload) return undefined;

  const selected =
    app.isPackaged && process.platform === "darwin"
      ? selectHotUpdatePayload(userDataPath)
      : undefined;
  const context: HotUpdateRuntimeContext = {
    currentVersion: selected?.version ?? app.getVersion(),
    selected,
    pending: readUpdateStore(userDataPath).pending?.version === selected?.version,
    payload: false,
  };
  (globalThis as Record<symbol, unknown>)[RUNTIME_CONTEXT_KEY] = context;

  if (!selected) return undefined;
  context.payload = true;
  return join(selected.asarPath, ".vite", "build", "main.js");
}
