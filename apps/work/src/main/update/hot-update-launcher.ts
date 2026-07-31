import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import {
  readUpdateStore,
  restoreDatabaseBackup,
  type StoredUpdate,
  writeUpdateStore,
} from "./update-store";
import { isStableVersionNewer } from "./version";

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

export function selectHotUpdatePayload(
  userDataPath: string,
  packagedVersion = app.getVersion(),
): StoredUpdate | undefined {
  const store = readUpdateStore(userDataPath);
  let stateChanged = false;

  const isUsableUpdate = (update: StoredUpdate | undefined): boolean =>
    Boolean(
      update &&
      existsSync(update.asarPath) &&
      isStableVersionNewer(update.version, packagedVersion),
    );

  if (store.active && !isUsableUpdate(store.active)) {
    delete store.active;
    stateChanged = true;
  }

  if (store.pending && !isUsableUpdate(store.pending)) {
    if (store.pending.launchAttempted) {
      restoreDatabaseBackup(userDataPath, store.databaseBackupPath);
    }
    delete store.pending;
    delete store.databaseBackupPath;
    stateChanged = true;
  }

  if (store.pending) {
    if (store.pending.launchAttempted) {
      restoreDatabaseBackup(userDataPath, store.databaseBackupPath);
      delete store.pending;
      delete store.databaseBackupPath;
      stateChanged = true;
    } else {
      store.pending.launchAttempted = true;
      stateChanged = true;
    }
  }

  const selected = store.pending ?? store.active;
  const effectiveVersion = selected?.version ?? packagedVersion;
  if (
    store.staged &&
    (!existsSync(store.staged.asarPath) ||
      !isStableVersionNewer(store.staged.version, effectiveVersion))
  ) {
    delete store.staged;
    stateChanged = true;
  }

  if (stateChanged) writeUpdateStore(userDataPath, store);
  return selected;
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
