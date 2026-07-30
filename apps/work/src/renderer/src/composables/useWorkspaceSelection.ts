import type { WorkspaceInfo } from "@shared/api";
import { useLocalStorage } from "@vueuse/core";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter, type LocationQueryRaw } from "vue-router";
import { electronAPI } from "@/lib/ipc";

export const LAST_WORKSPACE_ID_STORAGE_KEY = "willow:last-workspace-id";

function parseWorkspaceId(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getCreatedAt(workspace: WorkspaceInfo): number {
  const createdAt =
    workspace.createdAt instanceof Date
      ? workspace.createdAt.getTime()
      : new Date(workspace.createdAt).getTime();
  return Number.isFinite(createdAt) ? createdAt : 0;
}

export function resolveWorkspaceId(
  workspaces: WorkspaceInfo[],
  queryWorkspaceId: unknown,
  cachedWorkspaceId: unknown,
): number | undefined {
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const queryId = parseWorkspaceId(queryWorkspaceId);
  if (queryId !== undefined && workspaceIds.has(queryId)) return queryId;

  if (queryWorkspaceId === undefined) {
    const cachedId = parseWorkspaceId(cachedWorkspaceId);
    if (cachedId !== undefined && workspaceIds.has(cachedId)) return cachedId;
  }

  return workspaces.reduce<WorkspaceInfo | undefined>((latest, workspace) => {
    if (!latest) return workspace;

    const createdAtDifference = getCreatedAt(workspace) - getCreatedAt(latest);
    if (createdAtDifference > 0 || (createdAtDifference === 0 && workspace.id > latest.id)) {
      return workspace;
    }
    return latest;
  }, undefined)?.id;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useWorkspaceSelection() {
  const route = useRoute();
  const router = useRouter();
  const cachedWorkspaceId = useLocalStorage<number | null>(LAST_WORKSPACE_ID_STORAGE_KEY, null);
  const pinnedWorkspaces = shallowRef<WorkspaceInfo[]>([]);
  const unpinnedWorkspaces = shallowRef<WorkspaceInfo[]>([]);
  const selectedWorkspaceId = ref<number>();
  const loadingWorkspaces = ref(false);
  const workspaceLoadError = ref("");
  const catalogLoaded = ref(false);
  let loadSequence = 0;

  const workspaces = computed(() => [...pinnedWorkspaces.value, ...unpinnedWorkspaces.value]);
  const selectedWorkspaceValue = computed(() =>
    selectedWorkspaceId.value === undefined ? undefined : String(selectedWorkspaceId.value),
  );

  async function synchronizeSelection() {
    if (route.name !== "home" || !catalogLoaded.value) return;

    const nextWorkspaceId = resolveWorkspaceId(
      workspaces.value,
      route.query.workspaceId,
      cachedWorkspaceId.value,
    );
    selectedWorkspaceId.value = nextWorkspaceId;
    cachedWorkspaceId.value = nextWorkspaceId ?? null;

    const currentWorkspaceId = parseWorkspaceId(route.query.workspaceId);
    if (currentWorkspaceId === nextWorkspaceId && route.query.workspaceId !== undefined) return;
    if (currentWorkspaceId === undefined && nextWorkspaceId === undefined) {
      if (route.query.workspaceId === undefined) return;
    }

    const query: LocationQueryRaw = { ...route.query };
    if (nextWorkspaceId === undefined) {
      delete query.workspaceId;
    } else {
      query.workspaceId = String(nextWorkspaceId);
    }
    await router.replace({ name: "home", query });
  }

  async function loadWorkspaces() {
    const sequence = ++loadSequence;
    loadingWorkspaces.value = true;
    workspaceLoadError.value = "";

    try {
      const [pinnedResponse, unpinnedResponse] = await Promise.all([
        electronAPI.getWorkspaceList({ pinned: true }),
        electronAPI.getWorkspaceList({ pinned: false }),
      ]);
      if (sequence !== loadSequence) return;

      pinnedWorkspaces.value = pinnedResponse.workspaces;
      unpinnedWorkspaces.value = unpinnedResponse.workspaces;
      catalogLoaded.value = true;
      await synchronizeSelection();
    } catch (error) {
      if (sequence !== loadSequence) return;
      workspaceLoadError.value = getErrorMessage(error, "读取项目失败，请重试。");
      if (!catalogLoaded.value) selectedWorkspaceId.value = undefined;
    } finally {
      if (sequence === loadSequence) loadingWorkspaces.value = false;
    }
  }

  async function selectWorkspace(value: unknown) {
    const workspaceId = parseWorkspaceId(value);
    if (
      workspaceId === undefined ||
      !workspaces.value.some((workspace) => workspace.id === workspaceId)
    ) {
      return;
    }

    selectedWorkspaceId.value = workspaceId;
    cachedWorkspaceId.value = workspaceId;
    const query: LocationQueryRaw = { ...route.query, workspaceId: String(workspaceId) };
    delete query.sessionId;
    await router.push({ name: "home", query });
  }

  function handleWorkspaceSelectOpen(open: boolean) {
    if (open) void loadWorkspaces();
  }

  watch(
    () => [route.name, route.query.workspaceId] as const,
    ([routeName]) => {
      if (routeName !== "home") return;
      if (catalogLoaded.value) {
        void synchronizeSelection();
      } else {
        void loadWorkspaces();
      }
    },
  );

  onMounted(() => {
    if (route.name === "home") void loadWorkspaces();
  });

  return {
    pinnedWorkspaces,
    unpinnedWorkspaces,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspaceValue,
    loadingWorkspaces,
    workspaceLoadError,
    selectWorkspace,
    handleWorkspaceSelectOpen,
  };
}
