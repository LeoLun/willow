import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";

export function systemTemporaryDirectories(): string[] {
  const directories = [tmpdir(), ...(existsSync("/tmp") ? ["/tmp"] : [])];
  return [...new Set(directories.map((directory) => realpathSync(directory)))];
}
