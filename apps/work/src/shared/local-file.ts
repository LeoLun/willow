export const LOCAL_FILE_GRANT_CUSTOM_TYPE = "willow.local-file-grant";
export const LOCAL_FILE_BLOCK_START = "<willow_local_files>";
export const LOCAL_FILE_BLOCK_END = "</willow_local_files>";

export interface LocalFileAttachment {
  path: string;
  name: string;
  fileType: string;
  mimeType?: string;
}

export interface LocalFileGrant {
  requestId: string;
  files: LocalFileAttachment[];
}

export interface ParsedLocalFilePrompt {
  content: string;
  grant?: LocalFileGrant;
}

function isLocalFileAttachment(value: unknown): value is LocalFileAttachment {
  if (typeof value !== "object" || value === null) return false;
  const file = value as Record<string, unknown>;
  return (
    typeof file.path === "string" &&
    file.path !== "" &&
    typeof file.name === "string" &&
    file.name !== "" &&
    typeof file.fileType === "string" &&
    file.fileType !== "" &&
    (file.mimeType === undefined || (typeof file.mimeType === "string" && file.mimeType !== ""))
  );
}

export function isImageAttachment(
  file: LocalFileAttachment,
): file is LocalFileAttachment & { mimeType: string } {
  if (typeof file.mimeType === "string" && file.mimeType.startsWith("image/")) {
    return true;
  }
  if (typeof file.fileType === "string" && file.fileType !== "") {
    const ft = file.fileType.toUpperCase();
    if (["PNG", "JPG", "JPEG", "GIF", "WEBP", "SVG", "BMP", "ICO", "AVIF"].includes(ft)) {
      return true;
    }
  }
  return false;
}

export function isLocalFileGrant(value: unknown): value is LocalFileGrant {
  if (typeof value !== "object" || value === null) return false;
  const grant = value as Record<string, unknown>;
  return (
    typeof grant.requestId === "string" &&
    grant.requestId !== "" &&
    Array.isArray(grant.files) &&
    grant.files.length > 0 &&
    grant.files.every(isLocalFileAttachment)
  );
}

export function appendLocalFileBlock(content: string, grant: LocalFileGrant): string {
  return `${content}\n\n${LOCAL_FILE_BLOCK_START}\n${JSON.stringify(grant)}\n${LOCAL_FILE_BLOCK_END}`;
}

export function parseLocalFilePrompt(content: string): ParsedLocalFilePrompt {
  const trimmed = content.trimEnd();
  if (!trimmed.endsWith(LOCAL_FILE_BLOCK_END)) return { content };

  const start = trimmed.lastIndexOf(LOCAL_FILE_BLOCK_START);
  if (start < 0) return { content };
  const jsonStart = start + LOCAL_FILE_BLOCK_START.length;
  const jsonEnd = trimmed.length - LOCAL_FILE_BLOCK_END.length;

  try {
    const grant: unknown = JSON.parse(trimmed.slice(jsonStart, jsonEnd).trim());
    if (!isLocalFileGrant(grant)) return { content };
    const userText = content.slice(0, content.lastIndexOf(LOCAL_FILE_BLOCK_START)).trimEnd();
    return { content: userText, grant };
  } catch {
    return { content };
  }
}
