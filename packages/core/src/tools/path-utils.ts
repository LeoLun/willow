import { resolve, isAbsolute, relative } from "path";

export function resolveToCwd(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function isPathInsideCwd(path: string, cwd: string): boolean {
  try {
    const root = resolve(cwd);
    const target = resolveToCwd(path, root);
    const rel = relative(root, target);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  } catch {
    return false;
  }
}
