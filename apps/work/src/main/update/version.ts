export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  normalized: string;
}

export function parseStableVersion(value: string): ParsedVersion | undefined {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value.trim());
  if (!match) return undefined;
  const [major, minor, patch] = match.slice(1).map(Number);
  return { major, minor, patch, normalized: `${major}.${minor}.${patch}` };
}

export function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

export function isStableVersionNewer(candidateValue: string, currentValue: string): boolean {
  const candidate = parseStableVersion(candidateValue);
  const current = parseStableVersion(currentValue);
  return Boolean(candidate && current && compareVersions(candidate, current) > 0);
}

export function classifyUpdate(
  currentValue: string,
  latestValue: string,
): "none" | "hot" | "manual" {
  const current = parseStableVersion(currentValue);
  const latest = parseStableVersion(latestValue);
  if (!current || !latest || compareVersions(latest, current) <= 0) return "none";
  return current.major === 1 && latest.major === current.major ? "hot" : "manual";
}
