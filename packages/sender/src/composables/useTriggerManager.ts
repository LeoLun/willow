import type { Editor } from "@tiptap/core";
import type { ShallowRef } from "vue";
import { computed, ref } from "vue";

export interface TriggerConfig {
  char: string;
  pattern: RegExp;
}

export interface TriggerContext {
  trigger: string;
  query: string;
  range: { from: number; to: number };
}

export function useTriggerManager(
  editor: ShallowRef<Editor | undefined>,
  triggers: TriggerConfig[],
) {
  const activeTrigger = ref<TriggerContext | null>(null);
  const manualPanel = ref<string | null>(null);
  const activeIndex = ref(0);

  const isAnyPanelVisible = computed(
    () => activeTrigger.value !== null || manualPanel.value !== null,
  );

  const activeTriggerChar = computed<string | null>(() => {
    if (activeTrigger.value) return activeTrigger.value.trigger;
    return manualPanel.value;
  });

  const isSearchMode = computed(() => activeTrigger.value !== null);

  const query = computed(() => activeTrigger.value?.query ?? "");

  function detectTrigger(currentEditor: Editor): TriggerContext | null {
    const { from, empty, $from } = currentEditor.state.selection;
    if (!empty) return null;

    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");

    for (const trigger of triggers) {
      const match = textBefore.match(trigger.pattern);
      if (!match) continue;

      const token = match[1];
      const start = from - token.length;
      return {
        trigger: trigger.char,
        query: token.slice(1),
        range: { from: start, to: from },
      };
    }

    return null;
  }

  function syncFromEditor(currentEditor: Editor) {
    const nextContext = detectTrigger(currentEditor);

    if (activeTrigger.value?.query !== nextContext?.query) {
      activeIndex.value = 0;
    }

    activeTrigger.value = nextContext;
  }

  function navigateUp(): boolean {
    if (activeIndex.value <= 0) return false;
    activeIndex.value -= 1;
    return true;
  }

  function navigateDown(maxIndex: number): boolean {
    if (activeIndex.value >= maxIndex) return false;
    activeIndex.value += 1;
    return true;
  }

  function close() {
    manualPanel.value = null;
    activeTrigger.value = null;
    activeIndex.value = 0;
  }

  function clearTriggerText() {
    if (!activeTrigger.value || !editor.value) return;
    editor.value.chain().focus().deleteRange(activeTrigger.value.range).run();
  }

  function toggleManualPanel(triggerChar: string) {
    if (manualPanel.value === triggerChar) {
      manualPanel.value = null;
      return;
    }
    manualPanel.value = triggerChar;
    activeIndex.value = 0;
    editor.value?.commands.focus();
  }

  function resetActiveIndex() {
    activeIndex.value = 0;
  }

  return {
    activeTrigger,
    manualPanel,
    activeIndex,
    isAnyPanelVisible,
    activeTriggerChar,
    isSearchMode,
    query,
    syncFromEditor,
    navigateUp,
    navigateDown,
    close,
    clearTriggerText,
    toggleManualPanel,
    resetActiveIndex,
  };
}
