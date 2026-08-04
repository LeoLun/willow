<script setup lang="ts">
import type { LocalFileAttachment, ModelConfig, PermissionMode } from "@shared/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-vue-next";
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  render,
  useSlots,
  watch,
} from "vue";
import { baseShadowStyles } from "@/components/ui/base-shadow";
import BorderBeam from "@/components/ui/BorderBeam.vue";
import { electronAPI } from "@/lib/ipc";
import { getSourceSelection, restoreSourceSelection, serializeComposerDom } from "./editor-dom";
import LocalFileCard from "./LocalFileCard.vue";
import { parseComposerContent } from "./token-parser";
import type {
  ComposerInsertOptions,
  ComposerModelOption,
  ComposerOption,
  ComposerPanelKeydownPayload,
  ComposerPanelSlotProps,
  ComposerPanelType,
  ComposerSubmitPayload,
  ComposerTokenRule,
} from "./types";

interface Props {
  approvalOptions?: ComposerOption[];
  models?: ComposerModelOption[];
  tokenRules?: ComposerTokenRule[];
  disabled?: boolean;
  submitting?: boolean;
  streaming?: boolean;
  stopping?: boolean;
  placeholder?: string;
}

type TriggerState = {
  type: ComposerPanelType;
  query: string;
  start: number;
  end: number;
};

const props = withDefaults(defineProps<Props>(), {
  approvalOptions: () => [],
  models: () => [],
  tokenRules: () => [],
  disabled: false,
  submitting: false,
  streaming: false,
  stopping: false,
  placeholder: "需要做些什么？@ 引用对话文件，/ 调用技能",
});

const content = defineModel<string>("content", { default: "" });
const attachments = defineModel<LocalFileAttachment[]>("attachments", { default: () => [] });
const approvalMode = defineModel<PermissionMode | undefined>("approvalMode");
const model = defineModel<ModelConfig | undefined>("model");
const reasoningEffort = defineModel<string | undefined>("reasoningEffort");

const emit = defineEmits<{
  submit: [payload: ComposerSubmitPayload];
  stop: [];
  "panel-keydown": [payload: ComposerPanelKeydownPayload];
}>();

defineSlots<{
  "mention-panel"(props: ComposerPanelSlotProps): unknown;
  "slash-panel"(props: ComposerPanelSlotProps): unknown;
}>();

const slots = useSlots();
const editor = ref<HTMLElement>();
const composing = ref(false);
const editorFocused = ref(false);
const selectingFiles = ref(false);
const attachmentError = ref("");
const trigger = ref<TriggerState>();
let lastSelection = { start: 0, end: 0 };
const renderedTokens = new Set<HTMLElement>();

const segments = computed(() => parseComposerContent(content.value, props.tokenRules));
const selectedModel = computed(() =>
  props.models.find(
    (candidate) =>
      candidate.value.providerId === model.value?.providerId &&
      candidate.value.modelId === model.value?.modelId,
  ),
);
const reasoningOptions = computed(() => selectedModel.value?.reasoningEfforts ?? []);
const selectedApproval = computed(() =>
  props.approvalOptions.find((option) => option.value === approvalMode.value),
);
const approvalLabel = computed(() => selectedApproval.value?.label ?? "审批");
const modelLabel = computed(() => selectedModel.value?.label ?? "选择模型");
const reasoningLabel = computed(
  () =>
    reasoningOptions.value.find((option) => option.value === reasoningEffort.value)?.label ??
    "思考程度",
);
const canSubmit = computed(
  () =>
    (content.value.trim() !== "" || attachments.value.length > 0) &&
    !props.disabled &&
    !props.submitting &&
    (props.approvalOptions.length === 0 || approvalMode.value !== undefined) &&
    model.value !== undefined &&
    (reasoningOptions.value.length === 0 ||
      reasoningOptions.value.some((option) => option.value === reasoningEffort.value)),
);
const showStopAction = computed(
  () => content.value.trim() === "" && attachments.value.length === 0 && props.streaming,
);
const actionDisabled = computed(() =>
  showStopAction.value ? props.disabled || props.stopping : !canSubmit.value,
);
const activePanelSlot = computed(() => {
  if (trigger.value?.type === "mention") return slots["mention-panel"];
  if (trigger.value?.type === "slash") return slots["slash-panel"];
  return undefined;
});

function modelValueKey(value: ModelConfig): string {
  return JSON.stringify([value.providerId, value.modelId]);
}

function showModelGroup(index: number): boolean {
  const current = props.models[index]?.group;
  return Boolean(current && (index === 0 || props.models[index - 1]?.group !== current));
}

function closePanel(): void {
  trigger.value = undefined;
}

function unmountRenderedTokens(): void {
  for (const token of renderedTokens) render(null, token);
  renderedTokens.clear();
}

function renderEditorContent(value: string): void {
  const root = editor.value;
  if (!root) return;
  unmountRenderedTokens();
  const fragment = document.createDocumentFragment();
  for (const segment of parseComposerContent(value, props.tokenRules)) {
    if (segment.type === "text") {
      fragment.append(document.createTextNode(segment.content));
      continue;
    }
    const token = document.createElement("span");
    token.className = "mx-0.5 inline-flex align-middle";
    token.setAttribute("contenteditable", "false");
    token.dataset.tokenSource = segment.source;
    token.dataset.tokenRule = segment.ruleId;
    render(h(segment.component, segment.props), token);
    renderedTokens.add(token);
    fragment.append(token);
  }
  if (value.endsWith("\n")) {
    // Chromium needs a trailing BR to render the empty line after a terminal newline.
    fragment.append(document.createElement("br"));
  }
  root.replaceChildren(fragment);
}

function detectTrigger(source: string, caret: number): TriggerState | undefined {
  const prefix = source.slice(0, caret);
  const match = /(?:^|\s)([@/])([^\s@/]*)$/.exec(prefix);
  if (!match) return undefined;
  const marker = match[1];
  const query = match[2] ?? "";
  return {
    type: marker === "@" ? "mention" : "slash",
    query,
    start: caret - query.length - 1,
    end: caret,
  };
}

function updateSelectionAndPanel(): void {
  if (composing.value) return;
  const root = editor.value;
  if (!root) return;
  const selection = getSourceSelection(root);
  if (!selection) return;
  lastSelection = selection;
  if (selection.start !== selection.end) {
    closePanel();
    return;
  }
  trigger.value = detectTrigger(content.value, selection.end);
}

async function setContentAndSelection(value: string, start: number, end = start): Promise<void> {
  content.value = value;
  lastSelection = { start, end };
  await nextTick();
  const root = editor.value;
  if (!root) return;
  renderEditorContent(value);
  root.focus();
  restoreSourceSelection(root, lastSelection);
  updateSelectionAndPanel();
}

async function handleInput(event?: InputEvent): Promise<void> {
  if (composing.value || event?.isComposing) return;
  const root = editor.value;
  if (!root) return;
  const selection = getSourceSelection(root) ?? lastSelection;
  const value = serializeComposerDom(root);
  content.value = value;
  lastSelection = selection;
  await nextTick();
  renderEditorContent(value);
  restoreSourceSelection(root, selection);
  updateSelectionAndPanel();
}

function handleCompositionEnd(): void {
  composing.value = false;
  void handleInput();
}

function tokenRangeAtCaret(
  direction: "backward" | "forward",
): { start: number; end: number } | undefined {
  if (lastSelection.start !== lastSelection.end) return undefined;
  let offset = 0;
  for (const segment of segments.value) {
    const length = segment.type === "text" ? segment.content.length : segment.source.length;
    const start = offset;
    const end = offset + length;
    if (
      segment.type === "token" &&
      ((direction === "backward" && end === lastSelection.start) ||
        (direction === "forward" && start === lastSelection.start))
    ) {
      return { start, end };
    }
    offset = end;
  }
  return undefined;
}

function removeSelectionOrToken(direction: "backward" | "forward"): boolean {
  const selection = getSourceSelection(editor.value!) ?? lastSelection;
  lastSelection = selection;
  const range = tokenRangeAtCaret(direction);
  if (!range) return false;
  void setContentAndSelection(
    content.value.slice(0, range.start) + content.value.slice(range.end),
    range.start,
  );
  return true;
}

async function insertAtSelection(text: string): Promise<void> {
  const selection = getSourceSelection(editor.value!) ?? lastSelection;
  const value = content.value.slice(0, selection.start) + text + content.value.slice(selection.end);
  await setContentAndSelection(value, selection.start + text.length);
}

async function insertFromPanel(text: string, options: ComposerInsertOptions = {}): Promise<void> {
  const activeTrigger = trigger.value;
  const replaceTrigger = options.replaceTrigger ?? true;
  const trailingSpace = options.trailingSpace ?? true;
  const selection =
    replaceTrigger && activeTrigger
      ? { start: activeTrigger.start, end: activeTrigger.end }
      : lastSelection;
  const inserted = `${text}${trailingSpace ? " " : ""}`;
  const value =
    content.value.slice(0, selection.start) + inserted + content.value.slice(selection.end);
  closePanel();
  await setContentAndSelection(value, selection.start + inserted.length);
}

function addAttachments(files: readonly LocalFileAttachment[]): void {
  const next = new Map(attachments.value.map((file) => [file.path, file]));
  for (const file of files) next.set(file.path, file);
  attachments.value = [...next.values()];
}

async function selectFiles(): Promise<void> {
  if (props.disabled || selectingFiles.value) return;
  selectingFiles.value = true;
  attachmentError.value = "";
  try {
    const response = await electronAPI.selectLocalFiles();
    addAttachments(response.files);
  } catch (error) {
    attachmentError.value = error instanceof Error ? error.message : "选择文件失败，请重试。";
  } finally {
    selectingFiles.value = false;
  }
}

function removeAttachment(path: string): void {
  attachments.value = attachments.value.filter((file) => file.path !== path);
}

function submit(): void {
  if (!canSubmit.value) return;
  closePanel();
  const payload: ComposerSubmitPayload = {
    content: content.value.trim(),
    attachments: attachments.value.map((file) => ({ ...file })),
    approvalMode: approvalMode.value,
    model: model.value,
    reasoningEffort: reasoningEffort.value,
  };
  emit("submit", payload);
  content.value = "";
  attachments.value = [];
  lastSelection = { start: 0, end: 0 };
}

function triggerAction(): void {
  if (showStopAction.value) {
    if (!actionDisabled.value) emit("stop");
    return;
  }
  submit();
}

async function handleKeydown(event: KeyboardEvent): Promise<void> {
  if (composing.value || event.isComposing) return;

  if (event.key === "Escape" && trigger.value) {
    event.preventDefault();
    closePanel();
    return;
  }

  if (
    trigger.value &&
    (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter")
  ) {
    event.preventDefault();
    emit("panel-keydown", {
      type: trigger.value.type,
      query: trigger.value.query,
      key: event.key,
      event,
    });
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    if (event.shiftKey) await insertAtSelection("\n");
    else submit();
    return;
  }

  if (event.key === "Backspace") {
    updateSelectionAndPanel();
    if (removeSelectionOrToken("backward")) event.preventDefault();
  } else if (event.key === "Delete") {
    updateSelectionAndPanel();
    if (removeSelectionOrToken("forward")) event.preventDefault();
  }
}

async function handlePaste(event: ClipboardEvent): Promise<void> {
  const pastedFiles = [...(event.clipboardData?.files ?? [])];
  if (pastedFiles.length > 0) {
    event.preventDefault();
    attachmentError.value = "";
    try {
      const paths = pastedFiles.map((file) => electronAPI.getPathForFile(file)).filter(Boolean);
      if (paths.length === 0) throw new Error("无法读取粘贴文件的本地路径");
      const response = await electronAPI.inspectLocalFiles({ paths });
      addAttachments(response.files);
    } catch (error) {
      attachmentError.value = error instanceof Error ? error.message : "粘贴文件失败，请重试。";
    }
    return;
  }
  event.preventDefault();
  await insertAtSelection(event.clipboardData?.getData("text/plain") ?? "");
}

function handleCopy(event: ClipboardEvent, cut: boolean): void {
  const root = editor.value;
  if (!root) return;
  const selection = getSourceSelection(root);
  if (!selection) return;
  event.preventDefault();
  event.clipboardData?.setData("text/plain", content.value.slice(selection.start, selection.end));
  if (cut && selection.start !== selection.end) {
    void setContentAndSelection(
      content.value.slice(0, selection.start) + content.value.slice(selection.end),
      selection.start,
    );
  }
}

function selectModel(value: unknown): void {
  if (typeof value !== "string") return;
  const selected = props.models.find((option) => modelValueKey(option.value) === value);
  if (!selected) return;
  model.value = selected.value;
  normalizeReasoningEffort(selected);
}

function normalizeReasoningEffort(selected: ComposerModelOption | undefined): void {
  if (!selected) return;
  const isSupported = selected.reasoningEfforts.some(
    (option) => option.value === reasoningEffort.value,
  );
  if (!isSupported) {
    reasoningEffort.value = selected.defaultReasoningEffort ?? selected.reasoningEfforts[0]?.value;
  }
}

watch(selectedModel, normalizeReasoningEffort, { immediate: true });

onMounted(() => {
  lastSelection = { start: content.value.length, end: content.value.length };
  renderEditorContent(content.value);
  document.addEventListener("selectionchange", updateSelectionAndPanel);
});

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", updateSelectionAndPanel);
  unmountRenderedTokens();
});

watch(content, (value) => {
  const root = editor.value;
  if (!root || serializeComposerDom(root) === value) return;
  const selection = getSourceSelection(root);
  renderEditorContent(value);
  if (selection && document.activeElement === root) {
    const end = Math.min(selection.end, value.length);
    restoreSourceSelection(root, { start: Math.min(selection.start, end), end });
  }
});
</script>

<template>
  <div
    class="relative flex w-full flex-col rounded-[1.75rem] border border-sidebar-border bg-background transition-[border-color,box-shadow]"
    :class="baseShadowStyles.glass"
    :data-disabled="props.disabled || undefined"
  >
    <div
      v-if="attachments.length > 0"
      class="mx-3 mt-3 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-slot="local-file-attachment-list"
    >
      <div class="flex w-max min-w-full flex-nowrap gap-1.5">
        <LocalFileCard
          v-for="file in attachments"
          :key="file.path"
          :file="file"
          compact
          removable
          @remove="removeAttachment(file.path)"
        />
      </div>
    </div>

    <p v-if="attachmentError" class="px-4 pt-2 text-xs text-destructive" role="alert">
      {{ attachmentError }}
    </p>

    <div
      v-if="trigger && activePanelSlot"
      class="absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-[1.75rem] border border-border bg-popover text-popover-foreground shadow-lg"
      data-slot="prompt-panel"
      @mousedown.prevent
    >
      <div class="max-h-72 overflow-y-auto px-2 py-3" data-slot="prompt-panel-scroll">
        <slot
          v-if="trigger.type === 'mention'"
          name="mention-panel"
          :query="trigger.query"
          :insert="insertFromPanel"
          :close="closePanel"
        />
        <slot
          v-else
          name="slash-panel"
          :query="trigger.query"
          :insert="insertFromPanel"
          :close="closePanel"
        />
      </div>
    </div>

    <div class="relative">
      <div
        v-if="content === '' && !composing"
        data-slot="prompt-placeholder"
        class="pointer-events-none absolute inset-x-5 text-sm text-muted-foreground"
        :class="attachments.length > 0 ? 'top-2' : 'top-4.5'"
      >
        {{ props.placeholder }}
      </div>
      <div
        ref="editor"
        data-slot="prompt-editor"
        role="textbox"
        aria-multiline="true"
        :aria-disabled="props.disabled"
        :contenteditable="!props.disabled"
        class="max-h-[17rem] min-h-[5rem] overflow-x-hidden overflow-y-auto px-4 py-4 text-sm leading-6 break-words whitespace-pre-wrap outline-none"
        :class="attachments.length > 0 ? 'pt-1' : ''"
        @input="handleInput"
        @focus="editorFocused = true"
        @blur="editorFocused = false"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @copy="handleCopy($event, false)"
        @cut="handleCopy($event, true)"
        @compositionstart="composing = true"
        @compositionend="handleCompositionEnd"
      />
    </div>

    <div class="flex min-w-0 items-center gap-1 px-3 pb-1.5">
      <button
        type="button"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
        :disabled="props.disabled || selectingFiles"
        aria-label="添加本地文件"
        @click="selectFiles"
      >
        <PlusIcon class="size-4" />
      </button>

      <DropdownMenu v-if="props.approvalOptions.length > 0">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex h-8 min-w-0 items-center gap-1 rounded-xl px-2 text-sm text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            :disabled="props.disabled"
          >
            <component
              :is="selectedApproval.icon"
              v-if="selectedApproval?.icon"
              class="size-4 shrink-0"
              aria-hidden="true"
            />
            <span class="truncate">{{ approvalLabel }}</span>
            <ChevronDownIcon class="size-3.5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start">
          <DropdownMenuRadioGroup v-model="approvalMode">
            <DropdownMenuRadioItem
              v-for="option in props.approvalOptions"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
              class="pr-8 pl-2 text-sm [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
            >
              <component :is="option.icon" v-if="option.icon" class="size-4" aria-hidden="true" />
              <span>{{ option.label }}</span>
              <template #indicator-icon>
                <CheckIcon class="size-4" />
              </template>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="ml-auto flex min-w-0 items-center gap-1">
        <DropdownMenu v-if="props.models.length > 0">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="inline-flex h-8 max-w-48 min-w-0 items-center gap-1 rounded-xl px-2 text-sm text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              :disabled="props.disabled"
            >
              <span class="truncate">{{ modelLabel }}</span>
              <ChevronDownIcon class="size-3.5 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" class="w-48">
            <DropdownMenuRadioGroup
              :model-value="model ? modelValueKey(model) : undefined"
              @update:model-value="selectModel"
            >
              <template v-for="(option, index) in props.models" :key="modelValueKey(option.value)">
                <DropdownMenuSeparator v-if="showModelGroup(index) && index > 0" />
                <DropdownMenuLabel
                  v-if="showModelGroup(index)"
                  class="text-xs text-muted-foreground"
                >
                  {{ option.group }}
                </DropdownMenuLabel>
                <DropdownMenuRadioItem
                  :value="modelValueKey(option.value)"
                  :disabled="option.disabled"
                  class="pr-8 pl-2 text-sm [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
                >
                  <span class="min-w-0 flex-1 truncate" :title="option.label">
                    {{ option.label }}
                  </span>
                  <template #indicator-icon>
                    <CheckIcon class="size-4" />
                  </template>
                </DropdownMenuRadioItem>
              </template>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu v-if="reasoningOptions.length > 0">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1 rounded-xl px-2 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              :disabled="props.disabled"
            >
              <span>{{ reasoningLabel }}</span>
              <ChevronDownIcon class="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" class="w-26 min-w-0">
            <DropdownMenuRadioGroup v-model="reasoningEffort">
              <DropdownMenuRadioItem
                v-for="option in reasoningOptions"
                :key="option.value"
                :value="option.value"
                :disabled="option.disabled"
                class="pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
              >
                {{ option.label }}
                <template #indicator-icon>
                  <CheckIcon class="size-4" />
                </template>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          class="ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-[background-color,opacity] disabled:pointer-events-none disabled:opacity-40"
          :class="
            showStopAction
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'bg-primary text-primary-foreground'
          "
          :disabled="actionDisabled"
          :aria-label="showStopAction ? '暂停生成' : '发送'"
          :aria-busy="showStopAction && props.stopping ? true : undefined"
          :data-action="showStopAction ? 'stop' : 'submit'"
          @click="triggerAction"
        >
          <span
            v-if="showStopAction"
            data-slot="stop-icon"
            class="size-2.5 rounded-[2px] bg-white dark:bg-black"
            aria-hidden="true"
          />
          <ArrowUpIcon v-else class="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <TransitionGroup name="prompt-border-beam">
      <BorderBeam
        v-if="editorFocused"
        key="red"
        :size="400"
        :path-radius="28"
        color-from="transparent"
        color-to="#ef4444"
        data-beam-color="red"
        data-slot="prompt-border-beam"
      />
      <BorderBeam
        v-if="editorFocused"
        key="blue"
        :size="400"
        :path-radius="28"
        :delay="3"
        :border-width="2"
        color-from="transparent"
        color-to="#3b82f6"
        data-beam-color="blue"
        data-slot="prompt-border-beam"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.prompt-border-beam-enter-active {
  transition: opacity 300ms ease-out;
}

.prompt-border-beam-leave-active {
  transition: opacity 200ms ease-in;
}

.prompt-border-beam-enter-from,
.prompt-border-beam-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .prompt-border-beam-enter-active,
  .prompt-border-beam-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
