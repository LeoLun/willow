<script setup lang="ts">
import type { FileSearchItem, WorkspaceFileContent, WorkspaceFilesChangedEvent } from "@shared/api";
import { WORKSPACE_FILES_CHANGED_EVENT } from "@shared/constants";
import { useClipboard, watchDebounced } from "@vueuse/core";
import { Button } from "@willow/shadcn/components/ui/button";
import { Input } from "@willow/shadcn/components/ui/input";
import {
  TreeItem,
  TreeRoot,
  type TreeItemSelectEvent,
  type TreeItemToggleEvent,
} from "@willow/shadcn/components/ui/tree";
import {
  ChevronRight,
  FileWarning,
  FolderOpen,
  Folder,
  LoaderCircle,
  Search,
  ExternalLink,
} from "lucide-vue-next";
import { resolveMaterialIcon, type ResolvedMaterialIcon } from "material-icon-resolver";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, watch } from "vue";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";
import FileEntryContextMenu from "./FileEntryContextMenu.vue";
import FileTreeLoadMore from "./FileTreeLoadMore.vue";
import MonacoCodeViewer from "./MonacoCodeViewer.vue";
import type { FilePanelState } from "./types";

interface DirectoryEntry {
  children: TreeEntry[];
  error?: string;
  id: string;
  kind: "directory";
  loaded: boolean;
  loadedPages: number;
  loading: boolean;
  name: string;
  nextCursor?: string;
  path: string;
}

interface FileEntry {
  id: string;
  kind: "file";
  name: string;
  path: string;
}

interface StatusEntry {
  directoryPath: string;
  id: string;
  kind: "status";
  message: string;
  status: "empty" | "error" | "load-more" | "loading";
}

type TreeEntry = DirectoryEntry | FileEntry | StatusEntry;

const FILE_BROWSER_WIDTH_STORAGE_KEY = "willow:file-panel-browser-width";
const FILE_BROWSER_WIDTH_EVENT = "willow:file-panel-browser-width-change";
const MIN_FILE_BROWSER_WIDTH = 152;
const RESIZE_HANDLE_WIDTH = 8;
const KEYBOARD_RESIZE_STEP = 16;

const props = defineProps<{
  workspaceId?: number;
  tabId: string;
  state: FilePanelState;
}>();

const emit = defineEmits<{
  "update:state": [state: FilePanelState];
}>();

const directoryNodes = new Map<string, DirectoryEntry>();
const fileNodes = new Map<string, FileEntry>();
const expandedDirectories = shallowRef<string[]>([]);
const rootEntries = shallowRef<TreeEntry[]>([]);
const searchQuery = ref("");
const searchEntries = shallowRef<FileSearchItem[]>([]);
const searchError = ref("");
const searchLoading = ref(false);
const previewFile = shallowRef<WorkspaceFileContent>();
const previewError = ref("");
const previewLoading = ref(false);
const openFileError = ref("");
const fileActionError = ref("");
const openingFile = ref(false);
const deletedFileName = ref("");
const deletedFilePath = ref("");
const workspaceName = ref("");
const splitLayout = shallowRef<HTMLElement>();
const splitLayoutWidth = ref(0);
const preferredBrowserWidth = ref(loadSavedBrowserWidth());
const resizingBrowser = ref(false);
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const { copy } = useClipboard({ legacy: true });
const showFileList = ref(true);

let rootNode = createDirectoryNode("", "");
let contentGeneration = 0;
let searchGeneration = 0;
let subscribedWorkspaceId: number | undefined;
let workspaceGeneration = 0;
let workspaceSwitchPromise = Promise.resolve();
let disposed = false;
let resizeObserver: ResizeObserver | undefined;
let resizeStartPointerX = 0;
let resizeStartBrowserWidth = 0;
let previousBodyUserSelect = "";

const selectedTreeEntry = computed(() => {
  const path = props.state.selectedFile?.path;
  return path ? fileNodes.get(path) : undefined;
});

const selectedFilePath = computed(
  () => props.state.selectedFile?.path ?? previewFile.value?.relativePath ?? deletedFilePath.value,
);

const breadcrumbSegments = computed(() => {
  if (!workspaceName.value) return [];
  const relativePathSegments = selectedFilePath.value?.split("/").filter(Boolean) ?? [];
  return [workspaceName.value, ...relativePathSegments];
});

const breadcrumbTitle = computed(() => breadcrumbSegments.value.join("/"));

const selectedLanguage = computed(() => languageForPath(selectedFilePath.value ?? ""));

const normalizedSearchQuery = computed(() => searchQuery.value.trim());

const maximumBrowserWidth = computed(() =>
  Math.max(0, Math.floor((splitLayoutWidth.value - RESIZE_HANDLE_WIDTH) / 2)),
);

const minimumBrowserWidth = computed(() =>
  Math.min(MIN_FILE_BROWSER_WIDTH, maximumBrowserWidth.value),
);

const browserWidth = computed(() => {
  const availableWidth = Math.max(0, splitLayoutWidth.value - RESIZE_HANDLE_WIDTH);
  const defaultWidth = Math.max(minimumBrowserWidth.value, Math.round(availableWidth / 3));
  return clampBrowserWidth(preferredBrowserWidth.value ?? defaultWidth);
});

const splitLayoutStyle = computed(() => {
  if (!showFileList.value) return { gridTemplateColumns: "minmax(0, 1fr)" };
  if (splitLayoutWidth.value <= RESIZE_HANDLE_WIDTH) return undefined;
  const previewWidth = splitLayoutWidth.value - RESIZE_HANDLE_WIDTH - browserWidth.value;
  return {
    gridTemplateColumns: `${previewWidth}px ${RESIZE_HANDLE_WIDTH}px ${browserWidth.value}px`,
  };
});

function loadSavedBrowserWidth(): number | undefined {
  try {
    const savedWidth = Number(localStorage.getItem(FILE_BROWSER_WIDTH_STORAGE_KEY));
    return Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : undefined;
  } catch {
    return undefined;
  }
}

function clampBrowserWidth(width: number): number {
  return Math.max(minimumBrowserWidth.value, Math.min(width, maximumBrowserWidth.value));
}

function saveBrowserWidth(): void {
  const width = Math.round(browserWidth.value);
  preferredBrowserWidth.value = width;
  try {
    localStorage.setItem(FILE_BROWSER_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Persistence is optional when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<number>(FILE_BROWSER_WIDTH_EVENT, { detail: width }));
}

function handleSharedBrowserWidth(event: Event): void {
  const width = (event as CustomEvent<number>).detail;
  if (Number.isFinite(width) && width > 0) preferredBrowserWidth.value = width;
}

function resizeBrowserFromPointer(event: PointerEvent): void {
  const pointerDelta = event.clientX - resizeStartPointerX;
  preferredBrowserWidth.value = clampBrowserWidth(resizeStartBrowserWidth - pointerDelta);
}

function stopBrowserResize(): void {
  if (!resizingBrowser.value) return;
  resizingBrowser.value = false;
  saveBrowserWidth();
  window.removeEventListener("pointermove", resizeBrowserFromPointer);
  window.removeEventListener("pointerup", stopBrowserResize);
  window.removeEventListener("pointercancel", stopBrowserResize);
  document.body.style.userSelect = previousBodyUserSelect;
}

function startBrowserResize(event: PointerEvent): void {
  if (event.button !== 0 || resizingBrowser.value) return;
  event.preventDefault();
  previousBodyUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  resizeStartPointerX = event.clientX;
  resizeStartBrowserWidth = browserWidth.value;
  preferredBrowserWidth.value = browserWidth.value;
  resizingBrowser.value = true;
  window.addEventListener("pointermove", resizeBrowserFromPointer);
  window.addEventListener("pointerup", stopBrowserResize);
  window.addEventListener("pointercancel", stopBrowserResize);
}

function handleResizeHandleKeydown(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const delta = event.key === "ArrowLeft" ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP;
  preferredBrowserWidth.value = clampBrowserWidth(browserWidth.value + delta);
  saveBrowserWidth();
}

function createDirectoryNode(path: string, name: string): DirectoryEntry {
  return {
    children: [],
    id: `directory:${path || "/"}`,
    kind: "directory",
    loaded: false,
    loadedPages: 0,
    loading: false,
    name,
    path,
  };
}

function createTreeEntry(entry: FileSearchItem): DirectoryEntry | FileEntry {
  const path = stripDirectorySuffix(entry.relativePath);
  if (entry.type === "directory") {
    const existing = directoryNodes.get(path);
    if (existing) return existing;
    const directory = createDirectoryNode(path, entry.name);
    directoryNodes.set(path, directory);
    return directory;
  }

  const file: FileEntry = {
    id: `file:${path}`,
    kind: "file",
    name: entry.name,
    path,
  };
  fileNodes.set(path, file);
  return file;
}

function directoryDisplayEntries(directory: DirectoryEntry): TreeEntry[] | undefined {
  if (!directory.loaded) {
    if (directory.loading) return [statusEntry(directory, "loading", "正在加载目录…")];
    if (directory.error) return [statusEntry(directory, "error", directory.error)];
    return [];
  }

  const entries = [...directory.children];
  if (directory.error) entries.push(statusEntry(directory, "error", directory.error));
  else if (directory.nextCursor) entries.push(statusEntry(directory, "load-more", "继续加载…"));
  if (entries.length === 0 && directory.path === "") {
    entries.push(statusEntry(directory, "empty", "工作区中没有可显示的文件"));
  }
  return entries.length > 0 ? entries : undefined;
}

function statusEntry(
  directory: DirectoryEntry,
  status: StatusEntry["status"],
  message: string,
): StatusEntry {
  return {
    directoryPath: directory.path,
    id: `status:${status}:${directory.path}:${directory.nextCursor ?? directory.loadedPages}`,
    kind: "status",
    message,
    status,
  };
}

function syncTree(): void {
  rootEntries.value = directoryDisplayEntries(rootNode) ?? [];
  triggerRef(rootEntries);
}

function getEntryChildren(entry: TreeEntry): TreeEntry[] | undefined {
  return entry.kind === "directory" ? directoryDisplayEntries(entry) : undefined;
}

function getEntryKey(entry?: TreeEntry): string {
  return entry?.id ?? "";
}

function stripDirectorySuffix(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

async function loadDirectory(directory: DirectoryEntry, append = false): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || directory.loading || (append && !directory.nextCursor)) return;

  const currentWorkspaceGeneration = workspaceGeneration;
  directory.loading = true;
  directory.error = undefined;
  syncTree();
  try {
    const response = await electronAPI.listWorkspaceDirectory({
      workspaceId,
      directoryPath: directory.path,
      ...(append && directory.nextCursor ? { cursor: directory.nextCursor } : {}),
      limit: 200,
    });
    if (currentWorkspaceGeneration !== workspaceGeneration || disposed) return;

    const entries = response.entries.map(createTreeEntry);
    directory.children = append ? [...directory.children, ...entries] : entries;
    directory.loaded = true;
    directory.loadedPages = append ? directory.loadedPages + 1 : 1;
    directory.nextCursor = response.nextCursor;
  } catch (error) {
    if (currentWorkspaceGeneration !== workspaceGeneration || disposed) return;
    directory.error = errorMessage(error, "无法读取目录");
  } finally {
    if (currentWorkspaceGeneration === workspaceGeneration && !disposed) {
      directory.loading = false;
      syncTree();
    }
  }
}

async function reloadDirectory(directory: DirectoryEntry): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || !directory.loaded || directory.loading) return;

  const currentWorkspaceGeneration = workspaceGeneration;
  const pagesToRestore = Math.max(1, directory.loadedPages);
  directory.loading = true;
  directory.error = undefined;
  syncTree();

  try {
    const entries: TreeEntry[] = [];
    let cursor: string | undefined;
    let loadedPages = 0;
    for (let page = 0; page < pagesToRestore; page += 1) {
      const response = await electronAPI.listWorkspaceDirectory({
        workspaceId,
        directoryPath: directory.path,
        ...(cursor ? { cursor } : {}),
        limit: 200,
      });
      if (currentWorkspaceGeneration !== workspaceGeneration || disposed) return;
      entries.push(...response.entries.map(createTreeEntry));
      loadedPages += 1;
      cursor = response.nextCursor;
      if (!cursor) break;
    }
    directory.children = entries;
    directory.loadedPages = loadedPages;
    directory.nextCursor = cursor;
  } catch (error) {
    if (currentWorkspaceGeneration !== workspaceGeneration || disposed) return;
    directory.error = errorMessage(error, "无法刷新目录");
  } finally {
    if (currentWorkspaceGeneration === workspaceGeneration && !disposed) {
      directory.loading = false;
      syncTree();
    }
  }
}

function handleTreeToggle(event: TreeItemToggleEvent<TreeEntry>): void {
  const entry = event.detail.value;
  if (entry?.kind === "directory" && !event.detail.isExpanded && !entry.loaded) {
    void loadDirectory(entry);
  }
}

function preventNonFileSelection(event: TreeItemSelectEvent<TreeEntry>): void {
  if (event.detail.value?.kind !== "file") event.preventDefault();
}

function selectTreeEntry(entry?: TreeEntry): void {
  if (entry?.kind === "file") selectFile(entry);
}

function selectSearchEntry(entry: FileSearchItem): void {
  if (entry.type !== "file") return;
  selectFile({
    id: `file:${entry.relativePath}`,
    kind: "file",
    name: entry.name,
    path: entry.relativePath,
  });
}

function selectFile(file: FileEntry): void {
  deletedFileName.value = "";
  deletedFilePath.value = "";
  emit("update:state", {
    selectedFile: {
      id: file.path,
      name: file.name,
      path: file.path,
    },
  });
}

async function loadFileContent(path: string): Promise<void> {
  const workspaceId = props.workspaceId;
  const currentGeneration = ++contentGeneration;
  previewFile.value = undefined;
  previewError.value = "";
  openFileError.value = "";
  deletedFileName.value = "";
  deletedFilePath.value = "";
  if (!workspaceId || !path) {
    previewLoading.value = false;
    return;
  }

  previewLoading.value = true;
  try {
    const response = await electronAPI.readWorkspaceFile({ workspaceId, relativePath: path });
    if (currentGeneration !== contentGeneration || disposed) return;
    previewFile.value = response.file;
  } catch (error) {
    if (currentGeneration !== contentGeneration || disposed) return;
    previewError.value = errorMessage(error, "无法读取文件");
  } finally {
    if (currentGeneration === contentGeneration && !disposed) previewLoading.value = false;
  }
}

async function openWorkspaceFile(
  relativePath: string,
  reportError: (message: string) => void,
): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || !relativePath || openingFile.value) return;

  openingFile.value = true;
  try {
    await electronAPI.openWorkspaceFile({ workspaceId, relativePath });
  } catch (error) {
    reportError(errorMessage(error, "无法使用系统应用打开文件"));
  } finally {
    openingFile.value = false;
  }
}

async function openFileWithSystemApplication(): Promise<void> {
  const relativePath = props.state.selectedFile?.path;
  if (!relativePath) return;
  openFileError.value = "";
  await openWorkspaceFile(relativePath, (message) => {
    openFileError.value = message;
  });
}

async function openFileFromList(relativePath: string): Promise<void> {
  fileActionError.value = "";
  await openWorkspaceFile(relativePath, (message) => {
    fileActionError.value = message;
  });
}

async function revealWorkspaceEntry(relativePath: string): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || !relativePath) return;

  fileActionError.value = "";
  try {
    await electronAPI.revealWorkspaceEntry({ workspaceId, relativePath });
  } catch (error) {
    fileActionError.value = errorMessage(error, "无法打开所在文件夹");
  }
}

async function copyFilePath(relativePath: string): Promise<void> {
  fileActionError.value = "";
  try {
    await copy(relativePath);
  } catch (error) {
    fileActionError.value = errorMessage(error, "无法复制文件路径");
  }
}

async function runSearch(): Promise<void> {
  const workspaceId = props.workspaceId;
  const query = normalizedSearchQuery.value;
  const currentGeneration = ++searchGeneration;
  if (!workspaceId || !query) {
    searchEntries.value = [];
    searchError.value = "";
    searchLoading.value = false;
    return;
  }

  try {
    const response = await electronAPI.searchFiles({ workspaceId, query });
    if (currentGeneration !== searchGeneration || disposed) return;
    searchEntries.value = response.files;
  } catch (error) {
    if (currentGeneration !== searchGeneration || disposed) return;
    searchError.value = errorMessage(error, "无法搜索工作区文件");
  } finally {
    if (currentGeneration === searchGeneration && !disposed) searchLoading.value = false;
  }
}

function prepareSearch(): void {
  searchGeneration += 1;
  searchEntries.value = [];
  searchError.value = "";
  if (!normalizedSearchQuery.value || !props.workspaceId) {
    searchLoading.value = false;
    return;
  }
  searchLoading.value = true;
}

function scheduleSearch(): void {
  prepareSearch();
  void runSearch();
}

function resolveEntryIcon(
  entry: DirectoryEntry | FileEntry | FileSearchItem,
  isExpanded = false,
): ResolvedMaterialIcon {
  const isDirectory = "kind" in entry ? entry.kind === "directory" : entry.type === "directory";
  const path = "path" in entry ? entry.path : entry.relativePath;
  const icon = resolveMaterialIcon(path || entry.name, {
    type: isDirectory ? "folder" : "file",
    open: isDirectory && isExpanded,
  });
  if (!icon) throw new Error(`No Material icon fallback found for ${entry.name}`);
  return icon;
}

function retryStatus(entry: StatusEntry): void {
  const directory = entry.directoryPath ? directoryNodes.get(entry.directoryPath) : rootNode;
  if (!directory) return;
  if (directory.loaded) void reloadDirectory(directory);
  else void loadDirectory(directory);
}

function loadMore(entry: StatusEntry): void {
  const directory = entry.directoryPath ? directoryNodes.get(entry.directoryPath) : rootNode;
  if (directory) void loadDirectory(directory, true);
}

function handleWorkspaceFilesChanged(data: WorkspaceFilesChangedEvent): void {
  if (data.workspaceId !== props.workspaceId || data.changes.length === 0) return;

  const refreshAll = data.changes.some((change) => change.relativePath === ".gitignore");
  const directoriesToRefresh = new Set<DirectoryEntry>();
  if (refreshAll) {
    if (rootNode.loaded) directoriesToRefresh.add(rootNode);
    for (const directory of directoryNodes.values()) {
      if (directory.loaded) directoriesToRefresh.add(directory);
    }
  } else {
    for (const change of data.changes) {
      if (change.type === "change") continue;
      const parentPath = parentDirectoryPath(change.relativePath);
      const directory = parentPath ? directoryNodes.get(parentPath) : rootNode;
      if (directory?.loaded) directoriesToRefresh.add(directory);
    }
  }

  for (const directory of directoriesToRefresh) void reloadDirectory(directory);
  if (normalizedSearchQuery.value) scheduleSearch();

  const selectedPath = props.state.selectedFile?.path;
  if (!selectedPath) return;
  const selectedChange = data.changes.find(
    (change) => stripDirectorySuffix(change.relativePath) === selectedPath,
  );
  if (selectedChange?.type === "change") {
    void loadFileContent(selectedPath);
  } else if (selectedChange?.type === "unlink") {
    contentGeneration += 1;
    previewFile.value = undefined;
    previewError.value = "";
    previewLoading.value = false;
    deletedFileName.value = props.state.selectedFile?.name ?? selectedPath;
    deletedFilePath.value = selectedPath;
    emit("update:state", {});
  }
}

function parentDirectoryPath(path: string): string {
  const normalized = stripDirectorySuffix(path);
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}

async function loadWorkspaceName(workspaceId: number, currentGeneration: number): Promise<void> {
  try {
    const [pinnedResponse, unpinnedResponse] = await Promise.all([
      electronAPI.getWorkspaceList({ pinned: true }),
      electronAPI.getWorkspaceList({ pinned: false }),
    ]);
    if (currentGeneration !== workspaceGeneration || disposed) return;
    workspaceName.value =
      [...pinnedResponse.workspaces, ...unpinnedResponse.workspaces].find(
        (workspace) => workspace.id === workspaceId,
      )?.name ?? "";
  } catch {
    if (currentGeneration === workspaceGeneration && !disposed) workspaceName.value = "";
  }
}

async function switchWorkspace(
  workspaceId: number | undefined,
  currentGeneration: number,
): Promise<void> {
  if (currentGeneration !== workspaceGeneration || disposed) return;
  searchGeneration += 1;
  contentGeneration += 1;
  expandedDirectories.value = [];
  directoryNodes.clear();
  fileNodes.clear();
  rootNode = createDirectoryNode("", "");
  rootEntries.value = [];
  fileActionError.value = "";
  searchEntries.value = [];
  searchError.value = "";
  searchLoading.value = false;
  previewFile.value = undefined;
  previewError.value = "";
  previewLoading.value = false;
  deletedFileName.value = "";
  deletedFilePath.value = "";
  workspaceName.value = "";

  if (subscribedWorkspaceId !== undefined) {
    subscribedWorkspaceId = undefined;
    await electronAPI
      .unsubscribeWorkspaceFiles({ subscriptionId: props.tabId })
      .catch(() => undefined);
  }
  if (currentGeneration !== workspaceGeneration || disposed || !workspaceId) return;

  void loadDirectory(rootNode);
  void loadWorkspaceName(workspaceId, currentGeneration);
  try {
    await waitUntilReady();
    if (currentGeneration !== workspaceGeneration || disposed) return;
    await electronAPI.subscribeWorkspaceFiles({ subscriptionId: props.tabId, workspaceId });
    if (currentGeneration !== workspaceGeneration || disposed) {
      await electronAPI.unsubscribeWorkspaceFiles({ subscriptionId: props.tabId });
      return;
    }
    subscribedWorkspaceId = workspaceId;
  } catch (error) {
    if (currentGeneration === workspaceGeneration && !disposed) {
      console.error("订阅工作区文件变化失败:", error);
    }
  }
}

function languageForPath(path: string): { id: string; label: string } {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXTENSION[extension] ?? { id: "plaintext", label: "纯文本" };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback}：${error.message}` : fallback;
}

const LANGUAGE_BY_EXTENSION: Record<string, { id: string; label: string }> = {
  c: { id: "c", label: "C" },
  cc: { id: "cpp", label: "C++" },
  cpp: { id: "cpp", label: "C++" },
  css: { id: "css", label: "CSS" },
  go: { id: "go", label: "Go" },
  h: { id: "c", label: "C" },
  html: { id: "html", label: "HTML" },
  java: { id: "java", label: "Java" },
  js: { id: "javascript", label: "JavaScript" },
  json: { id: "json", label: "JSON" },
  jsx: { id: "javascript", label: "JavaScript JSX" },
  md: { id: "markdown", label: "Markdown" },
  py: { id: "python", label: "Python" },
  rs: { id: "rust", label: "Rust" },
  scss: { id: "scss", label: "SCSS" },
  sh: { id: "shell", label: "Shell" },
  sql: { id: "sql", label: "SQL" },
  ts: { id: "typescript", label: "TypeScript" },
  tsx: { id: "typescript", label: "TypeScript JSX" },
  vue: { id: "html", label: "Vue" },
  xml: { id: "xml", label: "XML" },
  yaml: { id: "yaml", label: "YAML" },
  yml: { id: "yaml", label: "YAML" },
};

addEventListener(WORKSPACE_FILES_CHANGED_EVENT, handleWorkspaceFilesChanged);
watch(
  () => props.workspaceId,
  (workspaceId) => {
    const currentGeneration = ++workspaceGeneration;
    workspaceSwitchPromise = workspaceSwitchPromise.then(() =>
      switchWorkspace(workspaceId, currentGeneration),
    );
  },
  { immediate: true },
);
watch(searchQuery, prepareSearch);
const stopSearchWatch = watchDebounced(
  [searchQuery, () => props.workspaceId],
  () => void runSearch(),
  { debounce: 120 },
);
watch(
  [() => props.workspaceId, () => props.state.selectedFile?.path],
  ([workspaceId, path]) => {
    if (workspaceId && path) void loadFileContent(path);
    else if (!path) {
      contentGeneration += 1;
      previewFile.value = undefined;
      previewError.value = "";
      previewLoading.value = false;
    }
  },
  { immediate: true },
);

onMounted(() => {
  const layout = splitLayout.value;
  if (!layout) return;
  splitLayoutWidth.value = layout.getBoundingClientRect().width;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) splitLayoutWidth.value = width;
    });
    resizeObserver.observe(layout);
  }
  window.addEventListener(FILE_BROWSER_WIDTH_EVENT, handleSharedBrowserWidth);
});

onBeforeUnmount(() => {
  disposed = true;
  workspaceGeneration += 1;
  searchGeneration += 1;
  contentGeneration += 1;
  stopSearchWatch();
  stopBrowserResize();
  resizeObserver?.disconnect();
  window.removeEventListener(FILE_BROWSER_WIDTH_EVENT, handleSharedBrowserWidth);
  removeEventListener(WORKSPACE_FILES_CHANGED_EVENT, handleWorkspaceFilesChanged);
  if (subscribedWorkspaceId !== undefined) {
    void electronAPI.unsubscribeWorkspaceFiles({ subscriptionId: props.tabId });
  }
});
</script>

<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col bg-background"
    data-slot="right-sidebar-file-panel"
    :data-tab-id="tabId"
    :data-workspace-id="workspaceId"
  >
    <div
      class="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b px-3 text-sm"
      data-slot="file-panel-toolbar"
    >
      <div
        class="flex min-w-0 items-center gap-1"
        data-slot="file-panel-breadcrumb"
        :title="breadcrumbTitle || undefined"
      >
        <template v-if="breadcrumbSegments.length > 0">
          <template v-for="(segment, index) in breadcrumbSegments" :key="`${index}:${segment}`">
            <ChevronRight
              v-if="index > 0"
              class="size-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span
              class="truncate text-xs text-muted-foreground"
              data-slot="file-panel-breadcrumb-segment"
            >
              {{ segment }}
            </span>
          </template>
        </template>
        <span v-else class="font-medium">/</span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="showFileList ? '隐藏文件列表' : '显示文件列表'"
        :aria-controls="`${tabId}-file-browser-region`"
        :aria-expanded="showFileList"
        :pressed="showFileList"
        @click="showFileList = !showFileList"
      >
        <FolderOpen v-show="showFileList" aria-hidden="true" />
        <Folder v-show="!showFileList" aria-hidden="true" />
      </Button>
    </div>

    <div
      ref="splitLayout"
      class="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_8px_minmax(9.5rem,1fr)]"
      :style="splitLayoutStyle"
      data-slot="file-panel-split-layout"
    >
      <div :id="`${tabId}-file-preview-region`" class="min-h-0 min-w-0">
        <div
          v-if="deletedFileName"
          class="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-5 text-center"
          data-slot="file-preview-deleted"
        >
          <FileWarning class="size-10 text-muted-foreground" aria-hidden="true" />
          <div>
            <p class="font-medium">文件已删除</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ deletedFileName }}</p>
          </div>
        </div>

        <div
          v-else-if="!state.selectedFile"
          class="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-5 text-center"
          data-slot="file-preview-empty"
        >
          <FolderOpen class="size-10 text-muted-foreground" aria-hidden="true" />
          <div>
            <p class="font-medium">打开文件</p>
            <p class="mt-1 text-sm text-muted-foreground">从工作区目录树中选择文件</p>
          </div>
        </div>

        <div
          v-else-if="previewLoading"
          class="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
          data-slot="file-preview-loading"
        >
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
          正在读取文件…
        </div>

        <div
          v-else-if="previewError"
          class="flex h-full flex-col items-center justify-center gap-3 px-5 text-center"
          data-slot="file-preview-error"
          role="alert"
        >
          <FileWarning class="size-9 text-destructive" aria-hidden="true" />
          <p class="text-sm text-destructive">{{ previewError }}</p>
          <Button size="sm" variant="outline" @click="loadFileContent(state.selectedFile.path)">
            重试
          </Button>
        </div>

        <div
          v-else-if="previewFile?.status === 'too-large'"
          class="flex h-full flex-col items-center justify-center gap-2 px-5 text-center"
          data-slot="file-preview-too-large"
        >
          <FileWarning class="size-9 text-muted-foreground" aria-hidden="true" />
          <p class="font-medium">文件过大，无法预览</p>
          <p class="text-sm text-muted-foreground">仅支持不超过 1 MiB 的文本文件</p>
          <Button
            class="mt-1"
            size="sm"
            variant="outline"
            :disabled="openingFile"
            @click="openFileWithSystemApplication"
          >
            <LoaderCircle v-if="openingFile" class="animate-spin" aria-hidden="true" />
            <ExternalLink v-else aria-hidden="true" />
            使用系统应用打开
          </Button>
          <p v-if="openFileError" class="text-sm text-destructive" role="alert">
            {{ openFileError }}
          </p>
        </div>

        <div
          v-else-if="previewFile?.status === 'binary'"
          class="flex h-full flex-col items-center justify-center gap-2 px-5 text-center"
          data-slot="file-preview-binary"
        >
          <FileWarning class="size-9 text-muted-foreground" aria-hidden="true" />
          <p class="font-medium">无法预览二进制文件</p>
          <p class="text-sm text-muted-foreground">当前面板仅支持 UTF-8 文本</p>
          <Button
            class="mt-1"
            size="sm"
            :disabled="openingFile"
            @click="openFileWithSystemApplication"
          >
            <LoaderCircle v-if="openingFile" class="animate-spin" aria-hidden="true" />
            <ExternalLink v-else aria-hidden="true" />
            使用系统应用打开
          </Button>
          <p v-if="openFileError" class="text-sm text-destructive" role="alert">
            {{ openFileError }}
          </p>
        </div>

        <div
          v-else-if="previewFile?.status === 'ready'"
          class="flex h-full min-h-0 flex-col"
          data-slot="file-preview"
        >
          <div class="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">
            {{ selectedLanguage.label }} · 只读预览
          </div>
          <MonacoCodeViewer
            class="min-h-0 flex-1"
            :aria-label="`${previewFile.name} 只读代码预览`"
            :code="previewFile.content ?? ''"
            :language="selectedLanguage.id"
          />
        </div>
      </div>

      <div
        v-show="showFileList"
        class="relative z-10 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border hover:after:bg-ring focus-visible:after:w-0.5 focus-visible:after:bg-ring"
        :class="{ 'after:bg-ring': resizingBrowser }"
        data-slot="file-panel-resize-handle"
        role="separator"
        aria-label="调整文件列表宽度"
        aria-orientation="vertical"
        :aria-controls="`${tabId}-file-preview-region ${tabId}-file-browser-region`"
        :aria-valuemin="minimumBrowserWidth"
        :aria-valuemax="maximumBrowserWidth"
        :aria-valuenow="browserWidth"
        tabindex="0"
        @pointerdown="startBrowserResize"
        @keydown="handleResizeHandleKeydown"
      />

      <aside
        v-show="showFileList"
        :id="`${tabId}-file-browser-region`"
        class="min-h-0 min-w-0 overflow-auto px-2 py-3"
        aria-label="工作区文件目录"
        data-slot="file-panel-browser"
      >
        <div class="relative mb-2">
          <Search
            class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            v-model="searchQuery"
            class="h-8 rounded-lg pl-8 text-xs"
            placeholder="筛选文件…"
          />
        </div>

        <p
          v-if="fileActionError"
          class="mb-2 px-2 text-xs text-destructive"
          data-slot="file-panel-action-error"
          role="alert"
        >
          {{ fileActionError }}
        </p>

        <template v-if="normalizedSearchQuery">
          <p
            v-if="searchLoading"
            class="px-2 py-3 text-xs text-muted-foreground"
            data-slot="file-panel-search-loading"
          >
            正在搜索…
          </p>
          <div
            v-else-if="searchError"
            class="space-y-2 px-2 py-3 text-xs text-destructive"
            data-slot="file-panel-search-error"
            role="alert"
          >
            <p>{{ searchError }}</p>
            <Button size="sm" variant="outline" @click="scheduleSearch">重试</Button>
          </div>
          <p
            v-else-if="searchEntries.length === 0"
            class="px-2 py-3 text-xs text-muted-foreground"
            data-slot="file-panel-search-empty"
          >
            没有匹配的文件或目录
          </p>
          <div v-else class="space-y-0.5" data-slot="file-panel-search-results">
            <FileEntryContextMenu
              v-for="entry in searchEntries"
              :key="entry.relativePath"
              :kind="entry.type"
              :path="entry.relativePath"
              @copy="copyFilePath"
              @open="openFileFromList"
              @reveal="revealWorkspaceEntry"
            >
              <button
                type="button"
                class="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted aria-disabled:cursor-default"
                :aria-disabled="entry.type === 'directory'"
                :data-entry-type="entry.type"
                :title="entry.relativePath"
                @click="selectSearchEntry(entry)"
              >
                <img :src="resolveEntryIcon(entry).cdnUrl" class="size-4 shrink-0" alt="" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{{ entry.name }}</span>
                  <span class="block truncate text-xs text-muted-foreground">
                    {{ entry.relativePath }}
                  </span>
                </span>
              </button>
            </FileEntryContextMenu>
          </div>
        </template>

        <TreeRoot
          v-else
          v-slot="{ flattenItems }"
          :items="rootEntries"
          :model-value="selectedTreeEntry"
          :expanded="expandedDirectories"
          :get-key="getEntryKey"
          :get-children="getEntryChildren"
          selection-behavior="replace"
          as="div"
          class="space-y-0.5 outline-none"
          aria-label="工作区文件"
          data-slot="file-tree"
          @update:expanded="expandedDirectories = $event"
          @update:model-value="selectTreeEntry"
        >
          <template v-for="item in flattenItems" :key="item._id">
            <FileTreeLoadMore
              v-if="item.value.kind === 'status' && item.value.status === 'load-more'"
              :style="{ paddingInlineStart: `${(item.level - 1) * 16 + 8}px` }"
              :disabled="
                (item.value.directoryPath ? directoryNodes.get(item.value.directoryPath) : rootNode)
                  ?.loading
              "
              @visible="loadMore(item.value)"
            />
            <button
              v-else-if="item.value.kind === 'status' && item.value.status === 'error'"
              type="button"
              class="min-h-8 w-full rounded-md pr-2 text-left text-xs text-destructive hover:bg-muted"
              :style="{ paddingInlineStart: `${(item.level - 1) * 16 + 8}px` }"
              data-slot="file-tree-error"
              @click="retryStatus(item.value)"
            >
              {{ item.value.message }}，点击重试
            </button>
            <div
              v-else-if="item.value.kind === 'status'"
              class="flex min-h-8 items-center pr-2 text-xs text-muted-foreground"
              :style="{ paddingInlineStart: `${(item.level - 1) * 16 + 8}px` }"
              :data-slot="`file-tree-${item.value.status}`"
              role="status"
            >
              <LoaderCircle
                v-if="item.value.status === 'loading'"
                class="mr-2 size-3.5 animate-spin"
                aria-hidden="true"
              />
              {{ item.value.message }}
            </div>
            <FileEntryContextMenu
              v-else
              :kind="item.value.kind"
              :path="item.value.path"
              @copy="copyFilePath"
              @open="openFileFromList"
              @reveal="revealWorkspaceEntry"
            >
              <TreeItem
                v-bind="item.bind"
                v-slot="{ isExpanded }"
                as="button"
                type="button"
                class="flex h-8 w-full items-center gap-2 rounded-md pr-2 text-left text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[selected]:bg-muted"
                :style="{ paddingInlineStart: `${(item.level - 1) * 16 + 8}px` }"
                :data-entry-id="item.value.path"
                :data-entry-kind="item.value.kind"
                @select="preventNonFileSelection"
                @toggle="handleTreeToggle"
              >
                <ChevronRight
                  v-if="item.hasChildren"
                  class="size-4 shrink-0 text-muted-foreground transition-transform"
                  :class="{ 'rotate-90': isExpanded }"
                  aria-hidden="true"
                />
                <span v-else class="size-4 shrink-0" aria-hidden="true" />
                <img
                  :src="resolveEntryIcon(item.value, isExpanded).cdnUrl"
                  :data-icon-name="resolveEntryIcon(item.value, isExpanded).name"
                  class="size-4 shrink-0"
                  alt=""
                  aria-hidden="true"
                />
                <span class="truncate">{{ item.value.name }}</span>
              </TreeItem>
            </FileEntryContextMenu>
          </template>
        </TreeRoot>
      </aside>
    </div>
  </section>
</template>
