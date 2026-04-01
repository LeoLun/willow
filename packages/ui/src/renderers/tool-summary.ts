import { i18n } from "../utils/i18n";

type ToolName = "read" | "write" | "edit" | "find" | "grep" | "ls" | "webfetch" | "websearch";

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
    base === "ls" ||
    base === "webfetch" ||
    base === "websearch"
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

function summarizeUrl(input: string | undefined): string {
  if (!input) return i18n("unknown");
  try {
    const url = new URL(input);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return input;
  }
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
      read: i18n("reading_file"),
      write: i18n("writing_file"),
      edit: i18n("editing_file"),
      find: i18n("finding_files"),
      grep: i18n("searching_content"),
      ls: i18n("listing_directory"),
      webfetch: i18n("fetch_web"),
      websearch: i18n("web_searching"),
    };
    return tool ? progressMap[tool] : i18n("tool_running");
  }

  if (!tool) return "";

  if (tool === "read") {
    const file = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("read_summary"), {
      file,
      start: safeDetails.startLine1Indexed ?? 1,
      shown: safeDetails.linesShown ?? 0,
      total: safeDetails.totalLines ?? 0,
    });
  }

  if (tool === "write") {
    const file = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("write_summary"), {
      file,
      lines: safeDetails.lineCount ?? 0,
      bytes: safeDetails.bytesWritten ?? 0,
    });
  }

  if (tool === "edit") {
    const file = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("edit_summary"), {
      file,
      before: safeDetails.bytesBefore ?? 0,
      after: safeDetails.bytesAfter ?? 0,
    });
  }

  if (tool === "ls") {
    const dir = basename(safeDetails.absolutePath || parsedParams.path);
    return formatTemplate(i18n("ls_summary"), {
      dir,
      returned: safeDetails.returned ?? 0,
      total: safeDetails.totalEntries ?? 0,
    });
  }

  if (tool === "find") {
    const pattern = parsedParams.pattern ?? i18n("unknown");
    return formatTemplate(i18n("find_summary"), {
      pattern,
      returned: safeDetails.returned ?? 0,
      total: safeDetails.totalMatched ?? 0,
    });
  }

  if (tool === "webfetch") {
    return formatTemplate(i18n("webfetch_summary"), {
      target: safeDetails.title || summarizeUrl(safeDetails.url || parsedParams.url),
      format: safeDetails.returnedFormat || parsedParams.format || "markdown",
    });
  }

  if (tool === "websearch") {
    const query = safeDetails.query || parsedParams.query || i18n("unknown");
    return formatTemplate(i18n("websearch_summary_done"), {
      query,
      count: safeDetails.resultCount ?? 0,
    });
  }

  const pattern = parsedParams.pattern ?? i18n("unknown");
  return formatTemplate(i18n("grep_summary"), {
    pattern,
    count: safeDetails.matchCount ?? 0,
  });
}
