import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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

export function cleanUnusedUpdateDirectories(
  userDataPath: string,
  store: UpdateStoreData = readUpdateStore(userDataPath),
): void {
  const updateDir = getUpdateDirectory(userDataPath);
  if (!existsSync(updateDir)) return;

  const keptVersions = new Set<string>();
  if (store.active?.version) keptVersions.add(`v${store.active.version}`);
  if (store.staged?.version) keptVersions.add(`v${store.staged.version}`);
  if (store.pending?.version) keptVersions.add(`v${store.pending.version}`);

  try {
    const entries = readdirSync(updateDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(updateDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("v") && !keptVersions.has(entry.name)) {
          rmSync(fullPath, { recursive: true, force: true });
        } else if (keptVersions.has(entry.name)) {
          try {
            const subEntries = readdirSync(fullPath);
            for (const file of subEntries) {
              if (file.endsWith(".part") || file.endsWith(".tmp")) {
                rmSync(join(fullPath, file), { force: true });
              }
            }
          } catch {
            // ignore
          }
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".part") || entry.name.endsWith(".tmp")) {
          rmSync(fullPath, { force: true });
        }
      }
    }
  } catch {
    // ignore
  }
}
