import type {
  AutomationChangedEvent,
  AutomationInfo,
  AutomationListItem,
  AutomationRunInfo,
  CreateAutomationRequest,
  UpdateAutomationRequest,
} from "@shared/api";
import { AUTOMATION_CHANGED_EVENT } from "@shared/constants";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useAutomationList() {
  const { addEventListener, removeEventListener } = useEventBus();
  const automations = shallowRef<AutomationListItem[]>([]);
  const loading = ref(false);
  const loadError = ref("");

  async function loadAutomations() {
    if (loading.value) return;
    loading.value = true;
    loadError.value = "";
    try {
      const response = await electronAPI.listAutomations();
      automations.value = response.automations;
    } catch (error) {
      loadError.value = getErrorMessage(error, "读取自动化列表失败，请重试。");
    } finally {
      loading.value = false;
    }
  }

  async function handleChanged(_payload: AutomationChangedEvent) {
    await loadAutomations();
  }

  onMounted(() => {
    addEventListener(AUTOMATION_CHANGED_EVENT, handleChanged);
    void loadAutomations();
  });

  onBeforeUnmount(() => {
    removeEventListener(AUTOMATION_CHANGED_EVENT, handleChanged);
  });

  return { automations, loading, loadError, loadAutomations };
}

export function useAutomationDetail(getAutomationId: () => number | undefined) {
  const { addEventListener, removeEventListener } = useEventBus();
  const automation = shallowRef<AutomationInfo>();
  const loading = ref(false);
  const loadError = ref("");
  const runs = shallowRef<AutomationRunInfo[]>([]);
  const nextCursor = ref<number>();
  const runsLoading = ref(false);
  const runsError = ref("");
  const changedHandlers = new Set<(payload: AutomationChangedEvent) => void>();
  const hasMore = computed(() => nextCursor.value !== undefined);

  async function loadAutomation() {
    const automationId = getAutomationId();
    if (automationId === undefined) return;
    loading.value = true;
    loadError.value = "";
    try {
      const response = await electronAPI.getAutomation({ id: automationId });
      automation.value = response.automation;
    } catch (error) {
      loadError.value = getErrorMessage(error, "读取自动化失败，请重试。");
    } finally {
      loading.value = false;
    }
  }

  async function loadRuns(reset: boolean) {
    const automationId = getAutomationId();
    if (automationId === undefined || runsLoading.value) return;
    runsLoading.value = true;
    runsError.value = "";
    try {
      const response = await electronAPI.listAutomationRuns({
        automationId,
        cursor: reset ? undefined : nextCursor.value,
      });
      runs.value = reset ? response.runs : [...runs.value, ...response.runs];
      nextCursor.value = response.nextCursor;
    } catch (error) {
      runsError.value = getErrorMessage(error, "读取执行历史失败，请重试。");
    } finally {
      runsLoading.value = false;
    }
  }

  async function refresh() {
    await Promise.all([loadAutomation(), loadRuns(true)]);
  }

  function onChanged(handler: (payload: AutomationChangedEvent) => void): () => void {
    changedHandlers.add(handler);
    return () => changedHandlers.delete(handler);
  }

  async function handleChanged(payload: AutomationChangedEvent) {
    if (payload.automationId !== getAutomationId()) return;
    await refresh();
    for (const handler of changedHandlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error("Automation changed handler failed:", error);
      }
    }
  }

  async function saveAutomation(request: UpdateAutomationRequest): Promise<AutomationInfo> {
    const response = await electronAPI.updateAutomation(request);
    automation.value = response.automation;
    return response.automation;
  }

  async function deleteAutomation(): Promise<void> {
    const automationId = getAutomationId();
    if (automationId === undefined) return;
    await electronAPI.deleteAutomation({ id: automationId });
  }

  async function runAutomationNow(): Promise<AutomationRunInfo> {
    const automationId = getAutomationId();
    if (automationId === undefined) throw new Error("自动化不存在");
    const run = await electronAPI.runAutomationNow({ id: automationId });
    await loadRuns(true);
    return run;
  }

  onMounted(() => {
    addEventListener(AUTOMATION_CHANGED_EVENT, handleChanged);
    void refresh();
  });

  onBeforeUnmount(() => {
    removeEventListener(AUTOMATION_CHANGED_EVENT, handleChanged);
    changedHandlers.clear();
  });

  return {
    automation,
    loading,
    loadError,
    runs,
    nextCursor,
    hasMore,
    runsLoading,
    runsError,
    refresh,
    loadRuns,
    loadMore: () => loadRuns(false),
    onChanged,
    saveAutomation,
    deleteAutomation,
    runAutomationNow,
  };
}

export function createAutomation(request: CreateAutomationRequest): Promise<AutomationInfo> {
  return electronAPI.createAutomation(request).then((response) => response.automation);
}
