import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export interface StoredUpdate {
  version: string;
  asarPath: string;
}

export interface UpdateStoreData {
  active?: StoredUpdate;
  staged?: StoredUpdate;
  pending?: StoredUpdate & { launchAttempted: boolean };
  databaseBackupPath?: string;
}

export const UPDATE_DIRECTORY_NAME = "updates";
export const UPDATE_STATE_FILE_NAME = "state.json";

export function getUpdateDirectory(userDataPath: string): string {
  return join(userDataPath, UPDATE_DIRECTORY_NAME);
}

export function getUpdateStatePath(userDataPath: string): string {
  return join(getUpdateDirectory(userDataPath), UPDATE_STATE_FILE_NAME);
}

export function readUpdateStore(userDataPath: string): UpdateStoreData {
  try {
    const value = JSON.parse(readFileSync(getUpdateStatePath(userDataPath), "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as UpdateStoreData;
  } catch {
    return {};
  }
}

export function writeUpdateStore(userDataPath: string, value: UpdateStoreData): void {
  const statePath = getUpdateStatePath(userDataPath);
  mkdirSync(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(temporaryPath, statePath);
}

export function restoreDatabaseBackup(userDataPath: string, backupPath?: string): void {
  if (!backupPath || !existsSync(backupPath)) return;
  const databasePath = join(userDataPath, "willow.db");
  mkdirSync(dirname(databasePath), { recursive: true });
  copyFileSync(backupPath, databasePath);
  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(backupPath, { force: true });
}
