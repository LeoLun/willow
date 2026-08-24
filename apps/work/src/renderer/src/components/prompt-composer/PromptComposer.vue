<script setup lang="ts">
import type { AgentMode, LocalFileAttachment, ModelConfig, PermissionMode } from "@shared/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@willow/shadcn/components/ui/popover";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  FilePlusIcon,
  FolderPlusIcon,
  ListTodoIcon,
  PlusIcon,
  XIcon,
} from "lucide-vue-next";
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
import { ContextUsageIndicator } from "@/components/session-usage";
import { baseShadowStyles } from "@/components/ui/base-shadow";
import BorderBeam from "@/components/ui/BorderBeam.vue";
import { electronAPI } from "@/lib/ipc";
import { getSourceSelection, restoreSourceSelection, serializeComposerDom } from "./editor-dom";
import LocalFileCard from "./LocalFileCard.vue";
import PromptTemplateField from "./PromptTemplateField.vue";
import { parseComposerContent } from "./token-parser";
import type {
  ComposerHandle,
  ComposerInsertOptions,
  ComposerModelOption,
  ComposerOption,
  ComposerPanelKeydownPayload,
  ComposerPanelSlotProps,
  ComposerPanelType,
  ComposerPromptTemplate,
  ComposerSubmitPayload,
  ComposerTemplateSegment,
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

type TemplateFieldSegment = Exclude<ComposerTemplateSegment, { type: "text" }>;

const SUPPORTED_CLIPBOARD_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface TemplateFieldRecord {
  host: HTMLElement;
  segment: TemplateFieldSegment;
}

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
const agentMode = defineModel<AgentMode>("agentMode", { default: "default" });
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
const addPopoverOpen = ref(false);
const attachmentError = ref("");
const attachmentPreviews = ref<Record<string, string>>({});
const trigger = ref<TriggerState>();
const templateMode = ref(false);
const templateFieldCount = ref(0);
let lastSelection = { start: 0, end: 0 };
const renderedTokens = new Set<HTMLElement>();
const templateFields = new Map<HTMLElement, TemplateFieldRecord>();

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
    (content.value.trim() !== "" || attachments.value.length > 0 || templateFieldCount.value > 0) &&
    !props.disabled &&
    !props.submitting &&
    (props.approvalOptions.length === 0 || approvalMode.value !== undefined) &&
    model.value !== undefined &&
    (reasoningOptions.value.length === 0 ||
      reasoningOptions.value.some((option) => option.value === reasoningEffort.value)),
);
const showStopAction = computed(
  () =>
    content.value.trim() === "" &&
    attachments.value.length === 0 &&
    templateFieldCount.value === 0 &&
    props.streaming,
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

function unmountTemplateFields(): void {
  for (const { host } of templateFields.values()) render(null, host);
  templateFields.clear();
  templateFieldCount.value = 0;
}

function clearTemplateState(): void {
  unmountTemplateFields();
  templateMode.value = false;
}

function appendParsedContent(parent: DocumentFragment, value: string): void {
  for (const segment of parseComposerContent(value, props.tokenRules)) {
    if (segment.type === "text") {
      parent.append(document.createTextNode(segment.content));
      continue;
    }
    const token = document.createElement("span");
    token.className = "mx-0.5 inline-flex align-middle";
    token.setAttribute("contenteditable", "false");
    token.dataset.tokenSource = segment.source;
    token.dataset.tokenRule = segment.ruleId;
    render(h(segment.component, segment.props), token);
    renderedTokens.add(token);
    parent.append(token);
  }
}

function setTemplateFieldInvalid(host: HTMLElement, invalid: boolean): void {
  if (invalid) host.dataset.invalid = "true";
  else delete host.dataset.invalid;
  const control = host.querySelector<HTMLElement>("[data-template-control]");
  if (invalid) control?.setAttribute("aria-invalid", "true");
  else control?.removeAttribute("aria-invalid");
}

function reconcileTemplateFields(): void {
  const root = editor.value;
  if (!root) return;
  for (const [host] of templateFields) {
    if (root.contains(host)) continue;
    render(null, host);
    templateFields.delete(host);
  }
  templateFieldCount.value = templateFields.size;
  if (templateFields.size === 0) templateMode.value = false;
}

function syncTemplateContent(): void {
  const root = editor.value;
  if (!root) return;
  reconcileTemplateFields();
  content.value = serializeComposerDom(root);
}

function updateTemplateField(host: HTMLElement, value: string): void {
  if (!editor.value?.contains(host)) return;
  host.dataset.templateValue = value;
  const record = templateFields.get(host);
  if (record?.segment.type === "select") renderTemplateField(record);
  setTemplateFieldInvalid(host, false);
  syncTemplateContent();
}

function renderTemplateField(record: TemplateFieldRecord): void {
  render(
    h(PromptTemplateField, {
      segment: record.segment,
      value: record.host.dataset.templateValue ?? "",
      disabled: props.disabled,
      "onUpdate:value": (value: string) => updateTemplateField(record.host, value),
    }),
    record.host,
  );
}

function createTemplateField(segment: TemplateFieldSegment): HTMLElement {
  const host = document.createElement("span");
  host.className = "inline-flex max-w-full align-baseline";
  host.setAttribute("contenteditable", "false");
  host.dataset.templateField = segment.type;
  host.dataset.templateValue = "";
  const record = { host, segment };
  templateFields.set(host, record);
  renderTemplateField(record);
  return host;
}

function renderEditorContent(value: string): void {
  const root = editor.value;
  if (!root) return;
  clearTemplateState();
  unmountRenderedTokens();
  const fragment = document.createDocumentFragment();
  appendParsedContent(fragment, value);
  if (value.endsWith("\n")) {
    // Chromium needs a trailing BR to render the empty line after a terminal newline.
    fragment.append(document.createElement("br"));
  }
  root.replaceChildren(fragment);
}

function renderTemplateContent(template: ComposerPromptTemplate): void {
  const root = editor.value;
  if (!root) return;
  unmountRenderedTokens();
  unmountTemplateFields();
  templateMode.value = true;
  const fragment = document.createDocumentFragment();
  for (const segment of template.segments) {
    if (segment.type === "text") appendParsedContent(fragment, segment.content);
    else fragment.append(createTemplateField(segment));
  }
  root.replaceChildren(fragment);
  templateFieldCount.value = templateFields.size;
  templateMode.value = templateFields.size > 0;
  const value = serializeComposerDom(root);
  if (value.endsWith("\n")) root.append(document.createElement("br"));
  content.value = value;
}

function templateControls(): HTMLElement[] {
  const root = editor.value;
  return root ? [...root.querySelectorAll<HTMLElement>("[data-template-control]")] : [];
}

function focusFirstTemplateField(): boolean {
  const first = templateControls()[0];
  first?.focus();
  return Boolean(first);
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

function replaceCurrentTemplateSelection(text: string, deleteBefore = 0): void {
  const root = editor.value;
  if (!root) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
  if (
    deleteBefore > 0 &&
    range.collapsed &&
    range.startContainer.nodeType === Node.TEXT_NODE &&
    range.startOffset >= deleteBefore
  ) {
    range.setStart(range.startContainer, range.startOffset - deleteBefore);
  }
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  appendParsedContent(fragment, text);
  const insertedNodes = [...fragment.childNodes];
  range.insertNode(fragment);
  const lastInserted = insertedNodes.at(-1);
  if (lastInserted?.parentNode) {
    range.setStartAfter(lastInserted);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  syncTemplateContent();
  lastSelection = getSourceSelection(root) ?? lastSelection;
  updateSelectionAndPanel();
}

async function handleInput(event?: InputEvent): Promise<void> {
  if (composing.value || event?.isComposing) return;
  const root = editor.value;
  if (!root) return;
  if (templateMode.value) {
    if (event?.target instanceof Element && event.target.closest("[data-template-field]")) return;
    const selection = getSourceSelection(root) ?? lastSelection;
    lastSelection = selection;
    syncTemplateContent();
    updateSelectionAndPanel();
    return;
  }
  const selection = getSourceSelection(root) ?? lastSelection;
  const value = serializeComposerDom(root);
  content.value = value;
  lastSelection = selection;
  await nextTick();
  renderEditorContent(value);
  restoreSourceSelection(root, selection);
  updateSelectionAndPanel();
}

function handleCompositionEnd(event: CompositionEvent): void {
  composing.value = false;
  if (event.target instanceof Element && event.target.closest("[data-template-field]")) return;
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

function adjacentTemplateField(direction: "backward" | "forward"): HTMLElement | undefined {
  const root = editor.value;
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0) return undefined;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return undefined;

  let node: Node = range.startContainer;
  let candidate: Node | undefined;
  if (node.nodeType === Node.TEXT_NODE) {
    const length = node.textContent?.length ?? 0;
    if (
      (direction === "backward" && range.startOffset > 0) ||
      (direction === "forward" && range.startOffset < length)
    ) {
      return undefined;
    }
    candidate = (direction === "backward" ? node.previousSibling : node.nextSibling) ?? undefined;
  } else {
    candidate =
      direction === "backward"
        ? node.childNodes[range.startOffset - 1]
        : node.childNodes[range.startOffset];
  }

  while (!candidate && node !== root) {
    candidate = (direction === "backward" ? node.previousSibling : node.nextSibling) ?? undefined;
    node = node.parentNode ?? root;
  }
  if (!(candidate instanceof HTMLElement) || !candidate.matches("[data-template-field]")) {
    return undefined;
  }
  return candidate;
}

function removeAdjacentTemplateField(direction: "backward" | "forward"): boolean {
  const root = editor.value;
  const field = adjacentTemplateField(direction);
  if (!root || !field) return false;
  const selection = getSourceSelection(root) ?? lastSelection;
  render(null, field);
  templateFields.delete(field);
  field.remove();
  templateFieldCount.value = templateFields.size;
  syncTemplateContent();
  root.focus();
  lastSelection = { start: selection.start, end: selection.start };
  restoreSourceSelection(root, lastSelection);
  updateSelectionAndPanel();
  return true;
}

function moveBetweenTemplateFields(event: KeyboardEvent): boolean {
  if (event.key !== "Tab" || !(event.target instanceof HTMLElement)) return false;
  if (!event.target.matches("[data-template-control]")) return false;
  const controls = templateControls();
  const index = controls.indexOf(event.target);
  const nextIndex = event.shiftKey ? index - 1 : index + 1;
  const next = controls[nextIndex];
  if (!next) return false;
  event.preventDefault();
  next.focus();
  return true;
}

async function insertAtSelection(text: string): Promise<void> {
  const selection = getSourceSelection(editor.value!) ?? lastSelection;
  if (templateMode.value) {
    replaceCurrentTemplateSelection(text);
    return;
  }
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
  if (templateMode.value) {
    closePanel();
    replaceCurrentTemplateSelection(
      inserted,
      replaceTrigger && activeTrigger ? activeTrigger.end - activeTrigger.start : 0,
    );
    return;
  }
  const value =
    content.value.slice(0, selection.start) + inserted + content.value.slice(selection.end);
  closePanel();
  await setContentAndSelection(value, selection.start + inserted.length);
}

async function replaceContentAndFocus(value: string): Promise<void> {
  closePanel();
  await setContentAndSelection(value, value.length);
}

async function insertContentAndFocus(
  text: string,
  options: ComposerInsertOptions = {},
): Promise<void> {
  const root = editor.value;
  if (!root) return;
  if (templateMode.value) {
    syncTemplateContent();
    clearTemplateState();
  }
  const selection = getSourceSelection(root) ?? lastSelection;
  const trailingSpace = options.trailingSpace ?? true;
  const inserted = `${text}${trailingSpace ? " " : ""}`;
  const value =
    content.value.slice(0, selection.start) + inserted + content.value.slice(selection.end);
  closePanel();
  await setContentAndSelection(value, selection.start + inserted.length);
}

async function loadTemplateAndFocus(template: ComposerPromptTemplate): Promise<void> {
  closePanel();
  const clonedTemplate: ComposerPromptTemplate = {
    segments: template.segments.map((segment) =>
      segment.type === "select"
        ? { ...segment, options: segment.options.map((option) => ({ ...option })) }
        : { ...segment },
    ),
  };
  await nextTick();
  renderTemplateContent(clonedTemplate);
  await nextTick();
  if (focusFirstTemplateField()) return;
  const root = editor.value;
  if (!root) return;
  root.focus();
  lastSelection = { start: content.value.length, end: content.value.length };
  restoreSourceSelection(root, lastSelection);
}

defineExpose<ComposerHandle>({
  insertContentAndFocus,
  loadTemplateAndFocus,
  replaceContentAndFocus,
});

function addAttachments(files: readonly LocalFileAttachment[]): void {
  const next = new Map(attachments.value.map((file) => [file.path, file]));
  for (const file of files) next.set(file.path, file);
  attachments.value = [...next.values()];
}

function setAttachmentPreview(path: string, preview: string): void {
  const previous = attachmentPreviews.value[path];
  if (previous && previous !== preview) window.URL.revokeObjectURL(previous);
  attachmentPreviews.value = { ...attachmentPreviews.value, [path]: preview };
}

function releaseAttachmentPreview(path: string): void {
  const preview = attachmentPreviews.value[path];
  if (!preview) return;
  window.URL.revokeObjectURL(preview);
  const next = { ...attachmentPreviews.value };
  delete next[path];
  attachmentPreviews.value = next;
}

function releaseAttachmentPreviews(): void {
  for (const preview of Object.values(attachmentPreviews.value)) {
    window.URL.revokeObjectURL(preview);
  }
  attachmentPreviews.value = {};
}

async function selectFiles(kind: "file" | "directory" = "file"): Promise<void> {
  if (props.disabled || selectingFiles.value) return;
  selectingFiles.value = true;
  attachmentError.value = "";
  try {
    const response = await electronAPI.selectLocalFiles(kind === "file" ? {} : { kind });
    addAttachments(response.files);
  } catch (error) {
    const fallback = kind === "directory" ? "选择文件夹失败，请重试。" : "选择文件失败，请重试。";
    attachmentError.value = error instanceof Error ? error.message : fallback;
  } finally {
    selectingFiles.value = false;
  }
}

function enablePlanMode(): void {
  agentMode.value = "plan";
  addPopoverOpen.value = false;
}

function disablePlanMode(): void {
  agentMode.value = "default";
}

function selectFilesFromPopover(): void {
  addPopoverOpen.value = false;
  void selectFiles();
}

function selectDirectoriesFromPopover(): void {
  addPopoverOpen.value = false;
  void selectFiles("directory");
}

function removeAttachment(path: string): void {
  releaseAttachmentPreview(path);
  attachments.value = attachments.value.filter((file) => file.path !== path);
}

function validateTemplateFields(): boolean {
  if (!templateMode.value) return true;
  reconcileTemplateFields();
  let firstInvalid: HTMLElement | undefined;
  for (const { host } of templateFields.values()) {
    const invalid = (host.dataset.templateValue ?? "").trim() === "";
    setTemplateFieldInvalid(host, invalid);
    if (invalid && !firstInvalid) firstInvalid = host;
  }
  firstInvalid?.querySelector<HTMLElement>("[data-template-control]")?.focus();
  return firstInvalid === undefined;
}

function submit(): void {
  if (!validateTemplateFields()) return;
  if (templateMode.value) syncTemplateContent();
  if (!canSubmit.value) return;
  closePanel();
  const payload: ComposerSubmitPayload = {
    content: content.value.trim(),
    attachments: attachments.value.map((file) => ({ ...file })),
    approvalMode: approvalMode.value,
    model: model.value,
    agentMode: agentMode.value,
    reasoningEffort: reasoningEffort.value,
  };
  emit("submit", payload);
  agentMode.value = "default";
  content.value = "";
  releaseAttachmentPreviews();
  attachments.value = [];
  lastSelection = { start: 0, end: 0 };
  renderEditorContent("");
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
  if (event.defaultPrevented || moveBetweenTemplateFields(event)) return;

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
    if (
      templateMode.value &&
      event.target === editor.value &&
      removeAdjacentTemplateField("backward")
    ) {
      event.preventDefault();
    } else if (!templateMode.value && removeSelectionOrToken("backward")) {
      event.preventDefault();
    }
  } else if (event.key === "Delete") {
    updateSelectionAndPanel();
    if (
      templateMode.value &&
      event.target === editor.value &&
      removeAdjacentTemplateField("forward")
    ) {
      event.preventDefault();
    } else if (!templateMode.value && removeSelectionOrToken("forward")) {
      event.preventDefault();
    }
  }
}

async function handlePaste(event: ClipboardEvent): Promise<void> {
  const pastedFiles = [...(event.clipboardData?.files ?? [])];
  if (pastedFiles.length > 0) {
    event.preventDefault();
    attachmentError.value = "";
    try {
      const paths: string[] = [];
      const clipboardImages: File[] = [];
      for (const file of pastedFiles) {
        const path = electronAPI.getPathForFile(file);
        if (path) {
          paths.push(path);
        } else if (SUPPORTED_CLIPBOARD_IMAGE_TYPES.has(file.type)) {
          clipboardImages.push(file);
        } else {
          throw new Error("仅支持粘贴没有本地路径的 PNG、JPEG、GIF 或 WebP 图片");
        }
      }

      const [localResponse, clipboardResponse] = await Promise.all([
        paths.length > 0 ? electronAPI.inspectLocalFiles({ paths }) : { files: [] },
        clipboardImages.length > 0
          ? electronAPI.persistClipboardImages({
              images: await Promise.all(
                clipboardImages.map(async (file) => ({
                  name: file.name,
                  mimeType: file.type,
                  data: await file.arrayBuffer(),
                })),
              ),
            })
          : { files: [] },
      ]);
      clipboardResponse.files.forEach((file, index) => {
        const clipboardImage = clipboardImages[index];
        if (clipboardImage) {
          setAttachmentPreview(file.path, window.URL.createObjectURL(clipboardImage));
        }
      });
      addAttachments([...localResponse.files, ...clipboardResponse.files]);
    } catch (error) {
      attachmentError.value = error instanceof Error ? error.message : "粘贴文件失败，请重试。";
    }
    return;
  }
  if (event.target instanceof HTMLInputElement && event.target.matches("[data-template-control]")) {
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
  const serialized = serializeComposerDom(root);
  event.clipboardData?.setData("text/plain", serialized.slice(selection.start, selection.end));
  if (cut && selection.start !== selection.end) {
    if (templateMode.value) {
      const browserSelection = window.getSelection();
      const range = browserSelection?.rangeCount ? browserSelection.getRangeAt(0) : undefined;
      range?.deleteContents();
      range?.collapse(true);
      if (range && browserSelection) {
        browserSelection.removeAllRanges();
        browserSelection.addRange(range);
      }
      lastSelection = { start: selection.start, end: selection.start };
      syncTemplateContent();
      return;
    }
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

watch(
  () => props.disabled,
  () => {
    if (!templateMode.value) return;
    for (const record of templateFields.values()) renderTemplateField(record);
  },
);

onMounted(() => {
  lastSelection = { start: content.value.length, end: content.value.length };
  renderEditorContent(content.value);
  document.addEventListener("selectionchange", updateSelectionAndPanel);
});

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", updateSelectionAndPanel);
  releaseAttachmentPreviews();
  unmountTemplateFields();
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
          :preview-src="attachmentPreviews[file.path]"
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
        v-if="content === '' && !composing && !templateMode"
        data-slot="prompt-placeholder"
        class="pointer-events-none absolute inset-x-4.5 text-sm text-muted-foreground"
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
      <Popover v-model:open="addPopoverOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            :disabled="props.disabled || selectingFiles"
            aria-label="添加内容或选择模式"
          >
            <PlusIcon class="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" class="w-52 p-1.5">
          <p class="px-2 py-1 text-xs font-medium text-muted-foreground">模式</p>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            :aria-pressed="agentMode === 'plan'"
            @click="enablePlanMode"
          >
            <ListTodoIcon class="size-4 text-muted-foreground" aria-hidden="true" />
            <span>计划模式</span>
            <CheckIcon
              v-if="agentMode === 'plan'"
              class="ml-auto size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
          <div class="my-1 h-px bg-border" aria-hidden="true"></div>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            @click="selectFilesFromPopover"
          >
            <FilePlusIcon class="size-4 text-muted-foreground" aria-hidden="true" />
            <span>文件</span>
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            @click="selectDirectoriesFromPopover"
          >
            <FolderPlusIcon class="size-4 text-muted-foreground" aria-hidden="true" />
            <span>文件夹</span>
          </button>
        </PopoverContent>
      </Popover>

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

      <div
        v-if="agentMode === 'plan'"
        class="group inline-flex h-8 items-center gap-1 rounded-xl bg-accent px-2 text-sm text-foreground"
        data-slot="plan-mode-indicator"
      >
        <ListTodoIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>计划模式</span>
        <button
          type="button"
          class="-mr-1 inline-flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background/70 focus-visible:opacity-100 focus-visible:outline-none"
          aria-label="关闭计划模式"
          @click="disablePlanMode"
        >
          <XIcon class="size-3.5" aria-hidden="true" />
        </button>
      </div>

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

        <ContextUsageIndicator />

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
        key="purple-highlight"
        :size="400"
        :path-radius="28"
        color-from="transparent"
        color-to="var(--primary-highlight)"
        data-beam-color="purple-highlight"
        data-slot="prompt-border-beam"
      />
      <BorderBeam
        v-if="editorFocused"
        key="purple"
        :size="400"
        :path-radius="28"
        :delay="3"
        :border-width="2"
        color-from="transparent"
        color-to="var(--ring)"
        data-beam-color="purple"
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
