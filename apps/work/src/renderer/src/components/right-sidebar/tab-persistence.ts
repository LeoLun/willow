import type { BoardPanelState, FilePanelState, ReviewPanelState, RightSidebarTab } from "./types";

export const RIGHT_SIDEBAR_TABS_STORAGE_KEY_PREFIX = "willow:chat-right-sidebar-tabs";
export const RIGHT_SIDEBAR_TABS_VERSION = 1;
export const MAX_PERSISTED_TAB_SERIALIZED_BYTES = 256 * 1024;

export interface PersistedPlanTabState {
  path: string;
}

export type PersistedRightSidebarTabState =
  | { kind: "board"; state: BoardPanelState }
  | { kind: "file"; state: FilePanelState }
  | { kind: "review"; state: ReviewPanelState }
  | { kind: "plan"; state: PersistedPlanTabState };

export interface PersistedRightSidebarTabs {
  version: typeof RIGHT_SIDEBAR_TABS_VERSION;
  activeTabIndex: number | null;
  tabs: PersistedRightSidebarTabState[];
}

export type RestoredRightSidebarTab =
  | { kind: "board"; state: BoardPanelState }
  | { kind: "file"; state: FilePanelState }
  | { kind: "review"; state: ReviewPanelState }
  | { kind: "plan"; state: PersistedPlanTabState };

export interface RestoredRightSidebarTabs {
  tabs: RestoredRightSidebarTab[];
  activeTabIndex: number | null;
}

export function getRightSidebarTabsStorageKey(workspaceId?: number): string {
  return `${RIGHT_SIDEBAR_TABS_STORAGE_KEY_PREFIX}:${workspaceId ?? "none"}`;
}

export function persistRightSidebarTabs(
  workspaceId: number | undefined,
  tabs: readonly RightSidebarTab[],
  activeTabId: string | undefined,
): void {
  const persistedTabs: PersistedRightSidebarTabState[] = [];
  for (const tab of tabs) {
    const state = serializeTabState(tab);
    if (state) persistedTabs.push(state);
  }

  const activeIndex = activeTabId ? tabs.findIndex((tab) => tab.id === activeTabId) : -1;
  const payload: PersistedRightSidebarTabs = {
    version: RIGHT_SIDEBAR_TABS_VERSION,
    activeTabIndex: activeIndex >= 0 ? activeIndex : null,
    tabs: persistedTabs.filter(
      (tab) => JSON.stringify(tab).length <= MAX_PERSISTED_TAB_SERIALIZED_BYTES,
    ),
  };

  try {
    localStorage.setItem(getRightSidebarTabsStorageKey(workspaceId), JSON.stringify(payload));
  } catch {
    // Persistence is optional when storage is unavailable or full.
  }
}

export function restoreRightSidebarTabs(workspaceId: number | undefined): RestoredRightSidebarTabs {
  try {
    const raw = localStorage.getItem(getRightSidebarTabsStorageKey(workspaceId));
    if (!raw) return { tabs: [], activeTabIndex: null };
    return normalizePersistedTabs(JSON.parse(raw) as unknown);
  } catch {
    return { tabs: [], activeTabIndex: null };
  }
}

function serializeTabState(tab: RightSidebarTab): PersistedRightSidebarTabState | undefined {
  switch (tab.kind) {
    case "board":
      return { kind: "board", state: tab.state as BoardPanelState };
    case "file":
      return { kind: "file", state: tab.state as FilePanelState };
    case "review":
      return { kind: "review", state: tab.state as ReviewPanelState };
    case "plan": {
      const path = tab.state.plan?.path;
      if (typeof path !== "string" || path.trim() === "") return undefined;
      return { kind: "plan", state: { path } };
    }
  }
}

function normalizePersistedTabs(value: unknown): RestoredRightSidebarTabs {
  if (
    !isRecord(value) ||
    value.version !== RIGHT_SIDEBAR_TABS_VERSION ||
    !Array.isArray(value.tabs)
  ) {
    return { tabs: [], activeTabIndex: null };
  }

  const tabs: RestoredRightSidebarTab[] = [];
  for (const candidate of value.tabs) {
    const tab = normalizeTab(candidate);
    if (tab) tabs.push(tab);
  }

  const activeTabIndex =
    typeof value.activeTabIndex === "number" &&
    Number.isInteger(value.activeTabIndex) &&
    value.activeTabIndex >= 0
      ? value.activeTabIndex
      : null;

  return { tabs, activeTabIndex };
}

function normalizeTab(value: unknown): RestoredRightSidebarTab | undefined {
  if (!isRecord(value) || !isRecord(value.state)) return undefined;
  const state = value.state as Record<string, unknown>;

  switch (value.kind) {
    case "board":
      return { kind: "board", state: {} };
    case "file":
      return { kind: "file", state: normalizeFileState(state) };
    case "review":
      return { kind: "review", state: normalizeReviewState(state) };
    case "plan":
      return isNonEmptyString(state.path)
        ? { kind: "plan", state: { path: state.path } }
        : undefined;
    default:
      return undefined;
  }
}

function normalizeFileState(state: Record<string, unknown>): FilePanelState {
  const selectedFile = isRecord(state.selectedFile) ? state.selectedFile : undefined;
  if (
    selectedFile &&
    isNonEmptyString(selectedFile.id) &&
    isNonEmptyString(selectedFile.name) &&
    isNonEmptyString(selectedFile.path)
  ) {
    return {
      selectedFile: {
        id: selectedFile.id,
        name: selectedFile.name,
        path: selectedFile.path,
      },
    };
  }
  return {};
}

function normalizeReviewState(state: Record<string, unknown>): ReviewPanelState {
  const selectedChange = isRecord(state.selectedChange) ? state.selectedChange : undefined;
  if (
    selectedChange &&
    (selectedChange.area === "staged" || selectedChange.area === "unstaged") &&
    isNonEmptyString(selectedChange.path)
  ) {
    return {
      selectedChange: {
        area: selectedChange.area,
        path: selectedChange.path,
      },
    };
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
