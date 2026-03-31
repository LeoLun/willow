import { i18n } from "../utils/i18n";

type ToolName = "read" | "write" | "edit" | "find" | "grep" | "ls";

function normalizeToolName(name: string | undefined): ToolName | null {
  if (!name) return null;
  const lowered = name.toLowerCase();
  const bySplit = lowered.split(/[/:.]/).filter(Boolean).pop() || lowered;
  const base = bySplit.replace(/[-_](tool|file)$/g, "");

  if (
    base === "read" ||
    base === "write" ||
    base === "edit" ||
    base === "find" ||
    base === "grep" ||
    base === "ls"
  ) {
    return base;
  }

  return null;
}

function parseParams(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
      return {};
    } catch {
      return {};
    }
  }
  return {};
}

function basename(input: string | undefined): string {
  if (!input) return i18n("unknown");
  const normalized = input.replace(/\\/g, "/");
  const trimmed = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  if (!trimmed) return i18n("unknown");
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || i18n("unknown");
}

function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined ? "" : String(value);
  });
}

export function getToolSummary(
  rawToolName: string | undefined,
  params: any,
  details: any,
  isInProgress: boolean,
): string {
  const tool = normalizeToolName(rawToolName);
  const parsedParams = parseParams(params);
  const safeDetails = (details ?? {}) as Record<string, any>;

  if (isInProgress) {
    const progressMap: Record<ToolName, string> = {
      read: i18n("Reading file..."),
      write: i18n("Writing file..."),
      edit: i18n("Editing file..."),
      find: i18n("Finding files..."),
      grep: i18n("Searching content..."),
      ls: i18n("Listing directory..."),
    };
    return tool ? progressMap[tool] : i18n("Tool running...");
  }

  if (!tool) return "";

  if (tool === "read") {
    const file = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("Read summary"), {
      file,
      start: safeDetails.startLine1Indexed ?? 1,
      shown: safeDetails.linesShown ?? 0,
      total: safeDetails.totalLines ?? 0,
    });
  }

  if (tool === "write") {
    const file = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("Write summary"), {
      file,
      lines: safeDetails.lineCount ?? 0,
      bytes: safeDetails.bytesWritten ?? 0,
    });
  }

  if (tool === "edit") {
    const file = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("Edit summary"), {
      file,
      before: safeDetails.bytesBefore ?? 0,
      after: safeDetails.bytesAfter ?? 0,
    });
  }

  if (tool === "ls") {
    const dir = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("Ls summary"), {
      dir,
      returned: safeDetails.returned ?? 0,
      total: safeDetails.totalEntries ?? 0,
    });
  }

  if (tool === "find") {
    const pattern = parsedParams.pattern ?? i18n("unknown");
    return formatTemplate(i18n("Find summary"), {
      pattern,
      returned: safeDetails.returned ?? 0,
      total: safeDetails.totalMatched ?? 0,
    });
  }

  const pattern = parsedParams.pattern ?? i18n("unknown");
  return formatTemplate(i18n("Grep summary"), {
    pattern,
    count: safeDetails.matchCount ?? 0,
  });
}
