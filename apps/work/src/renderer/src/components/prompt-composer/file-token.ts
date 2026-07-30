function escapeTokenValue(value: string, closingCharacter: "]" | ">"): string {
  const escapedBackslashes = value.replace(/\\/g, "\\\\");
  return closingCharacter === "]"
    ? escapedBackslashes.replace(/\]/g, "\\]")
    : escapedBackslashes.replace(/>/g, "\\>");
}

export function unescapeFileTokenValue(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

export function serializeFileToken(fileName: string, relativePath: string): string {
  return `[${escapeTokenValue(fileName, "]")}](<${escapeTokenValue(relativePath, ">")}>)`;
}
