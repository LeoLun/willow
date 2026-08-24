// @vitest-environment jsdom

import type { AgentMode, LocalFileAttachment, ModelConfig } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

const ipcMocks = vi.hoisted(() => ({
  getPathForFile: vi.fn(),
  inspectLocalFiles: vi.fn(),
  persistClipboardImages: vi.fn(),
  selectLocalFiles: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: ipcMocks,
}));
import {
  defaultComposerTokenRules,
  parseComposerContent,
  PromptComposer,
  serializeFileToken,
  type ComposerHandle,
  type ComposerModelOption,
  type ComposerPromptTemplate,
  serializeComposerSegments,
  type ComposerSubmitPayload,
  type ComposerTokenRule,
} from "../src/renderer/src/components/prompt-composer";
import {
  restoreSourceSelection,
  serializeComposerDom,
} from "../src/renderer/src/components/prompt-composer/editor-dom";

const mountedApps: ReturnType<typeof createApp>[] = [];

function mountComposer(
  options: {
    content?: string;
    agentMode?: AgentMode;
    attachments?: LocalFileAttachment[];
    withPanels?: boolean;
    model?: ModelConfig;
    models?: ComposerModelOption[];
    reasoningEffort?: string;
    streaming?: boolean;
    stopping?: boolean;
    submitting?: boolean;
  } = {},
) {
  const content = ref(options.content ?? "");
  const agentMode = ref<AgentMode>(options.agentMode ?? "default");
  const attachments = ref(options.attachments ?? []);
  const model = ref<ModelConfig>(options.model ?? { providerId: "provider", modelId: "model" });
  const models = ref(options.models ?? []);
  const reasoningEffort = ref<string | undefined>(options.reasoningEffort);
  const streaming = ref(options.streaming ?? false);
  const stopping = ref(options.stopping ?? false);
  const submitting = ref(options.submitting ?? false);
  const submissions: ComposerSubmitPayload[] = [];
  const composer = ref<ComposerHandle>();
  const stop = vi.fn();
  const panelKeydown = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);

  const app = createApp({
    setup() {
      return () =>
        h(
          PromptComposer,
          {
            ref: (value: unknown) => {
              composer.value = value as ComposerHandle;
            },
            content: content.value,
            agentMode: agentMode.value,
            attachments: attachments.value,
            model: model.value,
            models: models.value,
            reasoningEffort: reasoningEffort.value,
            streaming: streaming.value,
            stopping: stopping.value,
            submitting: submitting.value,
            tokenRules: [...defaultComposerTokenRules],
            "onUpdate:content": (value: string) => {
              content.value = value;
            },
            "onUpdate:agentMode": (value: AgentMode) => {
              agentMode.value = value;
            },
            "onUpdate:attachments": (value: LocalFileAttachment[]) => {
              attachments.value = value;
            },
            "onUpdate:model": (value: ModelConfig | undefined) => {
              model.value = value ?? model.value;
            },
            "onUpdate:reasoningEffort": (value: string | undefined) => {
              reasoningEffort.value = value;
            },
            onSubmit: (payload: ComposerSubmitPayload) => submissions.push(payload),
            onStop: stop,
            onPanelKeydown: panelKeydown,
          },
          options.withPanels
            ? {
                "mention-panel": ({
                  query,
                  insert,
                }: {
                  query: string;
                  insert: (value: string) => void;
                }) =>
                  h(
                    "button",
                    {
                      "data-test": "mention-panel",
                      onClick: () => insert("[work.vue](src/work.vue)"),
                    },
                    query,
                  ),
                "slash-panel": ({ query }: { query: string }) =>
                  h("div", { "data-test": "slash-panel" }, query),
              }
            : undefined,
        );
    },
  });
  app.mount(container);
  mountedApps.push(app);
  return {
    container,
    composer,
    agentMode,
    content,
    attachments,
    model,
    models,
    reasoningEffort,
    streaming,
    stopping,
    submitting,
    submissions,
    stop,
    panelKeydown,
  };
}

function setCaret(editor: HTMLElement, offset: number): void {
  editor.focus();
  restoreSourceSelection(editor, { start: offset, end: offset });
  document.dispatchEvent(new Event("selectionchange"));
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe("prompt composer token parser", () => {
  it("parses and losslessly serializes the built-in token rules", () => {
    const source = "修改 [work.vue](src/work.vue) 并使用 [!skill](tools/skill.md)";
    const segments = parseComposerContent(source, defaultComposerTokenRules);

    expect(segments.filter((segment) => segment.type === "token")).toHaveLength(2);
    expect(segments[1]).toMatchObject({
      type: "token",
      ruleId: "vue-file",
      source: "[work.vue](src/work.vue)",
    });
    expect(serializeComposerSegments(segments)).toBe(source);
  });

  it("parses real skill paths with an uppercase SKILL.md filename", () => {
    const source = "[!skill](/workspace/.willow/skills/review/SKILL.md)";
    const segments = parseComposerContent(source, defaultComposerTokenRules);

    expect(segments).toEqual([
      expect.objectContaining({
        type: "token",
        ruleId: "skill",
        source,
      }),
    ]);
    expect(serializeComposerSegments(segments)).toBe(source);
  });

  it("serializes and parses arbitrary workspace file tokens", () => {
    const source = serializeFileToken("draft]file", "docs/Guide (draft)>/README");
    const segments = parseComposerContent(source, defaultComposerTokenRules);

    expect(source).toBe("[draft\\]file](<docs/Guide (draft)\\>/README>)");
    expect(segments).toEqual([
      expect.objectContaining({
        type: "token",
        ruleId: "file",
        source,
        props: {
          fileName: "draft]file",
          path: "docs/Guide (draft)>/README",
        },
      }),
    ]);
    expect(serializeComposerSegments(segments)).toBe(source);
  });

  it("serializes and renders workspace directory tokens", () => {
    const source = serializeFileToken("components", "src/components/");
    const segments = parseComposerContent(source, defaultComposerTokenRules);

    expect(source).toBe("[components](<src/components/>)");
    expect(segments).toEqual([
      expect.objectContaining({
        type: "token",
        ruleId: "file",
        source,
        props: {
          fileName: "components",
          path: "src/components/",
        },
      }),
    ]);

    const mounted = mountComposer({ content: source });
    const token = mounted.container.querySelector<HTMLElement>("[data-token-rule=file]")!;
    expect(token.querySelector("[data-icon-type=directory]")).not.toBeNull();
    expect(token.querySelector("[data-icon-type=file]")).toBeNull();
  });

  it("does not treat HTTP links as workspace file tokens", () => {
    const source = "[OpenAI](<https://openai.com/docs>)";
    expect(parseComposerContent(source, defaultComposerTokenRules)).toEqual([
      { type: "text", content: source },
    ]);
  });

  it("uses rule order for overlapping matches and ignores zero-length rules", () => {
    const component = { render: () => null };
    const first: ComposerTokenRule = {
      id: "first",
      pattern: /abc/,
      component,
      createProps: () => ({}),
    };
    const second: ComposerTokenRule = { ...first, id: "second" };
    const empty: ComposerTokenRule = { ...first, id: "empty", pattern: /(?:)/ };

    const segments = parseComposerContent("abc", [empty, first, second]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: "token", ruleId: "first" });
  });

  it("keeps invalid markdown as plain text", () => {
    const source = "[work.vue](src/work.ts) [!skill](tools/other.md)";
    expect(parseComposerContent(source, defaultComposerTokenRules)).toEqual([
      { type: "text", content: source },
    ]);
  });
});

describe("PromptComposer", () => {
  const analysisTemplate: ComposerPromptTemplate = {
    segments: [
      { type: "text", content: "帮我撰写一份关于 " },
      { type: "input", placeholder: "竞品名称/某市场趋势/业务问题" },
      { type: "text", content: " 的分析报告。核心信息包括：" },
      {
        type: "select",
        placeholder: "选择信息范围",
        options: [
          { label: "关键数据", value: "关键数据" },
          { label: "用户反馈", value: "用户反馈与需求" },
        ],
      },
      { type: "text", content: "。" },
    ],
  };

  const reasoningModels: ComposerModelOption[] = [
    {
      value: { providerId: "provider", modelId: "deepseek-v4-pro" },
      label: "DeepSeek V4 Pro",
      reasoningEfforts: [
        { value: "high", label: "高" },
        { value: "max", label: "最大" },
      ],
      defaultReasoningEffort: "high",
    },
    {
      value: { providerId: "provider", modelId: "standard" },
      label: "Standard",
      reasoningEfforts: [
        { value: "low", label: "低" },
        { value: "high", label: "高" },
      ],
      defaultReasoningEffort: "low",
    },
    {
      value: { providerId: "provider", modelId: "no-reasoning" },
      label: "No reasoning",
      reasoningEfforts: [],
    },
  ];

  it("normalizes reasoning effort for the initially selected model", async () => {
    const mounted = mountComposer({
      model: reasoningModels[0].value,
      models: reasoningModels,
      reasoningEffort: "medium",
    });
    await nextTick();

    expect(mounted.reasoningEffort.value).toBe("high");
  });

  it("normalizes unsupported efforts and preserves supported efforts on model changes", async () => {
    const mounted = mountComposer({
      model: reasoningModels[0].value,
      models: reasoningModels,
      reasoningEffort: "high",
    });

    mounted.model.value = reasoningModels[1].value;
    await nextTick();
    expect(mounted.reasoningEffort.value).toBe("high");

    mounted.model.value = reasoningModels[0].value;
    await nextTick();
    mounted.reasoningEffort.value = "max";
    mounted.model.value = reasoningModels[1].value;
    await nextTick();
    expect(mounted.reasoningEffort.value).toBe("low");
  });

  it("clears reasoning effort when the selected model has no reasoning levels", async () => {
    const mounted = mountComposer({
      model: reasoningModels[0].value,
      models: reasoningModels,
      reasoningEffort: "high",
    });

    mounted.model.value = reasoningModels[2].value;
    await nextTick();
    expect(mounted.reasoningEffort.value).toBeUndefined();
  });

  it("renders tokens while preserving their source representation", () => {
    const mounted = mountComposer({ content: "Open [work.vue](src/work.vue)" });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const token = editor.querySelector<HTMLElement>("[data-token-rule=vue-file]")!;

    expect(token.textContent).toContain("work.vue");
    expect(token.getAttribute("contenteditable")).toBe("false");
    expect(token.classList.contains("align-middle")).toBe(true);
    expect(serializeComposerDom(editor)).toBe("Open [work.vue](src/work.vue)");
  });

  it("synchronizes edited text and submits on Enter", async () => {
    const mounted = mountComposer();
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    editor.textContent = "hello";
    setCaret(editor, 5);
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    await nextTick();

    expect(mounted.content.value).toBe("hello");
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(mounted.submissions).toEqual([
      expect.objectContaining({
        content: "hello",
        model: { providerId: "provider", modelId: "model" },
      }),
    ]);
    await nextTick();
    expect(mounted.content.value).toBe("");
    expect(editor.textContent).toBe("");
  });

  it("shows a stop action while streaming with empty content", async () => {
    const mounted = mountComposer({ streaming: true });
    const action = mounted.container.querySelector<HTMLButtonElement>("[data-action=stop]")!;

    expect(action.getAttribute("aria-label")).toBe("暂停生成");
    expect(action.disabled).toBe(false);
    expect(action.classList).toContain("dark:bg-white");
    expect(action.querySelector("[data-slot=stop-icon]")?.classList).toContain("dark:bg-black");
    action.click();
    expect(mounted.stop).toHaveBeenCalledOnce();

    mounted.stopping.value = true;
    await nextTick();
    expect(action.disabled).toBe(true);
    action.click();
    expect(mounted.stop).toHaveBeenCalledOnce();
  });

  it("switches from stop to submit while streaming when content is entered", async () => {
    const mounted = mountComposer({ streaming: true });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    editor.textContent = "queue this";
    setCaret(editor, 10);
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    await nextTick();

    const action = mounted.container.querySelector<HTMLButtonElement>("[data-action=submit]")!;
    expect(action.getAttribute("aria-label")).toBe("发送");
    expect(action.disabled).toBe(false);
    action.click();
    expect(mounted.submissions).toEqual([
      expect.objectContaining({
        content: "queue this",
        model: { providerId: "provider", modelId: "model" },
      }),
    ]);

    await nextTick();
    expect(mounted.container.querySelector("[data-action=stop]")).not.toBeNull();
  });

  it("keeps the idle empty submit action disabled", () => {
    const mounted = mountComposer();
    const action = mounted.container.querySelector<HTMLButtonElement>("[data-action=submit]")!;
    expect(action.getAttribute("aria-label")).toBe("发送");
    expect(action.disabled).toBe(true);
  });

  it("inserts a newline for Shift+Enter and does not submit while composing", async () => {
    const mounted = mountComposer({ content: "hello" });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    setCaret(editor, 5);

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }),
    );
    await nextTick();
    expect(mounted.content.value).toBe("hello\n");
    expect(editor.lastElementChild?.tagName).toBe("BR");
    expect(serializeComposerDom(editor)).toBe("hello\n");

    editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true }),
    );
    expect(mounted.submissions).toHaveLength(0);
  });

  it("does not rerender or commit partial IME composition text", async () => {
    const mounted = mountComposer();
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    expect(mounted.container.querySelector("[data-slot=prompt-placeholder]")).not.toBeNull();

    editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    await nextTick();
    expect(mounted.container.querySelector("[data-slot=prompt-placeholder]")).toBeNull();

    editor.textContent = "n";
    setCaret(editor, 1);
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertCompositionText",
        isComposing: true,
      }),
    );
    await nextTick();

    expect(mounted.content.value).toBe("");
    expect(editor.textContent).toBe("n");

    editor.textContent = "你";
    setCaret(editor, 1);
    editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "你" }));
    await nextTick();

    expect(mounted.content.value).toBe("你");
    expect(editor.textContent).toBe("你");
  });

  it("opens injected panels for triggers and forwards navigation keys", async () => {
    const mounted = mountComposer({ content: "@wor", withPanels: true });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    setCaret(editor, 4);
    await nextTick();

    expect(mounted.container.querySelector("[data-test=mention-panel]")?.textContent).toBe("wor");
    expect(mounted.container.querySelector("[data-slot=prompt-panel]")?.classList).toContain(
      "overflow-hidden",
    );
    expect(mounted.container.querySelector("[data-slot=prompt-panel-scroll]")?.classList).toContain(
      "overflow-y-auto",
    );
    for (const key of ["ArrowDown", "ArrowUp", "Enter"] as const) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      editor.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(mounted.panelKeydown).toHaveBeenCalledWith(
        expect.objectContaining({ type: "mention", query: "wor", key }),
      );
    }

    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    editor.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    expect(mounted.panelKeydown).toHaveBeenCalledTimes(3);

    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(mounted.container.querySelector("[data-test=mention-panel]")).toBeNull();
  });

  it("opens the system file selector from the add popover", async () => {
    ipcMocks.selectLocalFiles.mockResolvedValueOnce({ files: [] });
    const mounted = mountComposer({ withPanels: true });
    const plus = mounted.container.querySelector<HTMLButtonElement>(
      "[aria-label='添加内容或选择模式']",
    )!;
    plus.click();
    await nextTick();
    const fileButton = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "文件",
    )!;
    fileButton.click();
    await vi.waitFor(() => expect(ipcMocks.selectLocalFiles).toHaveBeenCalledOnce());
    expect(mounted.container.querySelector("[data-test=mention-panel]")).toBeNull();
  });

  it("selects, renders, and removes a local directory", async () => {
    const directory = {
      path: "/tmp/project",
      name: "project",
      fileType: "文件夹",
      kind: "directory" as const,
    };
    ipcMocks.selectLocalFiles.mockResolvedValueOnce({ files: [directory] });
    const mounted = mountComposer();
    mounted.container
      .querySelector<HTMLButtonElement>("[aria-label='添加内容或选择模式']")!
      .click();
    await nextTick();
    [...document.body.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "文件夹")!
      .click();

    await vi.waitFor(() => expect(mounted.attachments.value).toEqual([directory]));
    expect(ipcMocks.selectLocalFiles).toHaveBeenCalledWith({ kind: "directory" });
    const card = mounted.container.querySelector<HTMLElement>("[data-slot=local-file-card]")!;
    expect(card.textContent).toContain("project");
    expect(card.title).toBe("/tmp/project");
    const icon = card.querySelector<HTMLElement>("[data-slot=local-file-icon]")!;
    expect(icon.classList).toContain("overflow-visible");
    expect(icon.classList).not.toContain("overflow-hidden");

    mounted.container
      .querySelector<HTMLButtonElement>("[aria-label='移除文件夹：project']")!
      .click();
    await nextTick();
    expect(mounted.attachments.value).toEqual([]);
  });

  it("adds, deduplicates, renders, and removes selected local files", async () => {
    const file = { path: "/tmp/draft.md", name: "draft.md", fileType: "MD" };
    ipcMocks.selectLocalFiles.mockResolvedValueOnce({ files: [file, file] });
    const mounted = mountComposer();
    mounted.container
      .querySelector<HTMLButtonElement>("[aria-label='添加内容或选择模式']")!
      .click();
    await nextTick();
    [...document.body.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "文件")!
      .click();

    await vi.waitFor(() => expect(mounted.attachments.value).toEqual([file]));
    const card = mounted.container.querySelector<HTMLElement>("[data-slot=local-file-card]")!;
    expect(card.textContent).toContain("draft.md");
    expect(card.textContent).not.toContain("MD");
    expect(card.title).toBe("/tmp/draft.md");
    expect(card.classList).toContain("group");
    expect(card.getAttribute("data-variant")).toBe("compact");

    const removeButton = mounted.container.querySelector<HTMLButtonElement>(
      "[aria-label='移除文件：draft.md']",
    )!;
    expect([...removeButton.classList]).toEqual(
      expect.arrayContaining(["group-hover:opacity-100", "focus-visible:opacity-100"]),
    );

    removeButton.click();
    await nextTick();
    expect(mounted.attachments.value).toEqual([]);
  });

  it("activates Plan mode, exposes a close control, and resets it after submission", async () => {
    const mounted = mountComposer({ content: "Plan this feature" });
    mounted.container
      .querySelector<HTMLButtonElement>("[aria-label='添加内容或选择模式']")!
      .click();
    await nextTick();
    const planButton = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "计划模式",
    )!;
    planButton.click();
    await nextTick();

    expect(mounted.agentMode.value).toBe("plan");
    expect(mounted.container.querySelector("[data-slot=plan-mode-indicator]")).not.toBeNull();
    const close = mounted.container.querySelector<HTMLButtonElement>(
      "[aria-label='关闭计划模式']",
    )!;
    expect([...close.classList]).toEqual(
      expect.arrayContaining(["opacity-0", "group-hover:opacity-100", "focus-visible:opacity-100"]),
    );

    mounted.container.querySelector<HTMLButtonElement>("[data-action=submit]")!.click();
    expect(mounted.submissions).toEqual([
      expect.objectContaining({ content: "Plan this feature", agentMode: "plan" }),
    ]);
    await nextTick();
    expect(mounted.agentMode.value).toBe("default");
    expect(mounted.container.querySelector("[data-slot=plan-mode-indicator]")).toBeNull();
  });

  it("closes Plan mode without submitting", async () => {
    const mounted = mountComposer({ agentMode: "plan" });
    mounted.container.querySelector<HTMLButtonElement>("[aria-label='关闭计划模式']")!.click();
    await nextTick();

    expect(mounted.agentMode.value).toBe("default");
    expect(mounted.submissions).toHaveLength(0);
  });

  it("lays out compact attachments in one horizontally scrollable row", () => {
    const files = Array.from({ length: 9 }, (_, index) => ({
      path: `/tmp/file-${index}.txt`,
      name: `file-${index}.txt`,
      fileType: "TXT",
    }));
    const mounted = mountComposer({ attachments: files });
    const list = mounted.container.querySelector<HTMLElement>(
      "[data-slot=local-file-attachment-list]",
    )!;
    const grid = list.firstElementChild as HTMLElement;
    const cards = mounted.container.querySelectorAll<HTMLElement>("[data-slot=local-file-card]");

    expect([...list.classList]).toEqual(
      expect.arrayContaining(["overflow-x-auto", "overflow-y-hidden"]),
    );
    expect([...grid.classList]).toEqual(expect.arrayContaining(["flex", "w-max", "flex-nowrap"]));
    expect(cards).toHaveLength(9);
    expect([...(cards[0]?.classList ?? [])]).toEqual(
      expect.arrayContaining(["h-9", "w-fit", "shrink-0"]),
    );
  });

  it("pastes local files without inserting clipboard text", async () => {
    const mounted = mountComposer({ content: "start" });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const file = new File(["draft"], "draft.md", { type: "text/markdown" });
    ipcMocks.getPathForFile.mockReturnValueOnce("/tmp/draft.md");
    ipcMocks.inspectLocalFiles.mockResolvedValueOnce({
      files: [{ path: "/tmp/draft.md", name: "draft.md", fileType: "MD" }],
    });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [file], getData: () => "ignored text" },
    });

    editor.dispatchEvent(paste);
    await vi.waitFor(() => expect(mounted.attachments.value).toHaveLength(1));
    expect(mounted.content.value).toBe("start");
    expect(ipcMocks.inspectLocalFiles).toHaveBeenCalledWith({ paths: ["/tmp/draft.md"] });
  });

  it("pastes a directory as one attachment without inserting clipboard text", async () => {
    const mounted = mountComposer({ content: "start" });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const directory = new File([], "project");
    ipcMocks.getPathForFile.mockReturnValueOnce("/tmp/project");
    ipcMocks.inspectLocalFiles.mockResolvedValueOnce({
      files: [
        {
          path: "/tmp/project",
          name: "project",
          fileType: "文件夹",
          kind: "directory",
        },
      ],
    });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [directory], getData: () => "ignored text" },
    });

    editor.dispatchEvent(paste);
    await vi.waitFor(() =>
      expect(mounted.attachments.value).toEqual([
        {
          path: "/tmp/project",
          name: "project",
          fileType: "文件夹",
          kind: "directory",
        },
      ]),
    );
    expect(mounted.content.value).toBe("start");
    expect(ipcMocks.inspectLocalFiles).toHaveBeenCalledWith({ paths: ["/tmp/project"] });
    expect(mounted.container.querySelectorAll("[data-slot=local-file-card]")).toHaveLength(1);
  });

  it("persists a clipboard image without a local path", async () => {
    const mounted = mountComposer({ content: "start" });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    const file = new File([data], "image.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(data) });
    ipcMocks.getPathForFile.mockReturnValueOnce("");
    ipcMocks.persistClipboardImages.mockResolvedValueOnce({
      files: [
        {
          path: "/user/clipboard-images/id/image.png",
          name: "image.png",
          fileType: "PNG",
          mimeType: "image/png",
        },
      ],
    });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [file], getData: () => "ignored text" },
    });

    editor.dispatchEvent(paste);
    await vi.waitFor(() => expect(mounted.attachments.value).toHaveLength(1));

    expect(mounted.content.value).toBe("start");
    expect(ipcMocks.inspectLocalFiles).not.toHaveBeenCalled();
    expect(ipcMocks.persistClipboardImages).toHaveBeenCalledWith({
      images: [{ name: "image.png", mimeType: "image/png", data }],
    });
    expect(
      mounted.container.querySelector<HTMLImageElement>("[data-slot=local-file-card] img")?.src,
    ).toMatch(/^blob:/);
  });

  it("releases a clipboard image preview when removing the attachment", async () => {
    const mounted = mountComposer();
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const data = new Uint8Array([1]).buffer;
    const file = new File([data], "image.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(data) });
    ipcMocks.getPathForFile.mockReturnValueOnce("");
    ipcMocks.persistClipboardImages.mockResolvedValueOnce({
      files: [
        {
          path: "/user/clipboard-images/id/image.png",
          name: "image.png",
          fileType: "PNG",
          mimeType: "image/png",
        },
      ],
    });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });
    editor.dispatchEvent(paste);
    await vi.waitFor(() => expect(mounted.attachments.value).toHaveLength(1));

    mounted.container.querySelector<HTMLButtonElement>("[aria-label^='移除文件']")!.click();
    await nextTick();

    expect(mounted.attachments.value).toEqual([]);
  });

  it("pastes local files and pathless images together", async () => {
    const mounted = mountComposer();
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const localFile = new File(["draft"], "draft.md", { type: "text/markdown" });
    const data = new Uint8Array([1, 2, 3]).buffer;
    const image = new File([data], "image.png", { type: "image/png" });
    Object.defineProperty(image, "arrayBuffer", { value: vi.fn().mockResolvedValue(data) });
    ipcMocks.getPathForFile.mockReturnValueOnce("/tmp/draft.md").mockReturnValueOnce("");
    ipcMocks.inspectLocalFiles.mockResolvedValueOnce({
      files: [{ path: "/tmp/draft.md", name: "draft.md", fileType: "MD" }],
    });
    ipcMocks.persistClipboardImages.mockResolvedValueOnce({
      files: [
        {
          path: "/user/clipboard-images/id/image.png",
          name: "image.png",
          fileType: "PNG",
          mimeType: "image/png",
        },
      ],
    });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", { value: { files: [localFile, image] } });

    editor.dispatchEvent(paste);
    await vi.waitFor(() => expect(mounted.attachments.value).toHaveLength(2));

    expect(ipcMocks.inspectLocalFiles).toHaveBeenCalledWith({ paths: ["/tmp/draft.md"] });
    expect(ipcMocks.persistClipboardImages).toHaveBeenCalledOnce();
  });

  it("rejects pathless clipboard files that are not supported images", async () => {
    const mounted = mountComposer();
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const file = new File(["draft"], "draft.md", { type: "text/markdown" });
    ipcMocks.getPathForFile.mockReturnValueOnce("");
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });

    editor.dispatchEvent(paste);
    await vi.waitFor(() =>
      expect(mounted.container.querySelector("[role=alert]")?.textContent).toContain(
        "仅支持粘贴没有本地路径",
      ),
    );

    expect(mounted.attachments.value).toEqual([]);
    expect(ipcMocks.persistClipboardImages).not.toHaveBeenCalled();
  });

  it("shows an error when a clipboard image cannot be read", async () => {
    const mounted = mountComposer();
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const file = new File(["image"], "image.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockRejectedValue(new Error("无法读取剪贴板图片")),
    });
    ipcMocks.getPathForFile.mockReturnValueOnce("");
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });

    editor.dispatchEvent(paste);
    await vi.waitFor(() =>
      expect(mounted.container.querySelector("[role=alert]")?.textContent).toContain(
        "无法读取剪贴板图片",
      ),
    );

    expect(mounted.attachments.value).toEqual([]);
    expect(ipcMocks.persistClipboardImages).not.toHaveBeenCalled();
  });

  it("shows an error when persisting a clipboard image fails", async () => {
    const mounted = mountComposer();
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const data = new Uint8Array([1]).buffer;
    const file = new File([data], "image.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(data) });
    ipcMocks.getPathForFile.mockReturnValueOnce("");
    ipcMocks.persistClipboardImages.mockRejectedValueOnce(new Error("保存剪贴板图片失败"));
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });

    editor.dispatchEvent(paste);
    await vi.waitFor(() =>
      expect(mounted.container.querySelector("[role=alert]")?.textContent).toContain(
        "保存剪贴板图片失败",
      ),
    );

    expect(mounted.attachments.value).toEqual([]);
  });

  it("submits attachments with text and clears both models", async () => {
    const file = { path: "/tmp/draft.md", name: "draft.md", fileType: "MD" };
    const mounted = mountComposer({ content: "Review", attachments: [file] });
    mounted.container.querySelector<HTMLButtonElement>("[data-action=submit]")!.click();

    expect(mounted.submissions).toEqual([
      expect.objectContaining({ content: "Review", attachments: [file] }),
    ]);
    await nextTick();
    expect(mounted.content.value).toBe("");
    expect(mounted.attachments.value).toEqual([]);
  });

  it("submits an image attachment without requiring text", async () => {
    const image = {
      path: "/tmp/photo.png",
      name: "photo.png",
      fileType: "PNG",
      mimeType: "image/png",
    };
    const mounted = mountComposer({ attachments: [image] });
    const submit = mounted.container.querySelector<HTMLButtonElement>("[data-action=submit]")!;

    expect(submit.disabled).toBe(false);
    submit.click();
    expect(mounted.submissions).toEqual([
      expect.objectContaining({ content: "", attachments: [image] }),
    ]);
  });

  it("replaces a mention trigger through the injected callback", async () => {
    const mounted = mountComposer({ content: "open @wor", withPanels: true });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    setCaret(editor, 9);
    await nextTick();

    mounted.container.querySelector<HTMLButtonElement>("[data-test=mention-panel]")!.click();
    await nextTick();
    expect(mounted.content.value).toBe("open [work.vue](src/work.vue) ");
    expect(editor.querySelector("[data-token-rule=vue-file]")).not.toBeNull();
  });

  it("deletes an adjacent token atomically", async () => {
    const source = "open [work.vue](src/work.vue)";
    const mounted = mountComposer({ content: source });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    setCaret(editor, source.length);
    const backspace = new KeyboardEvent("keydown", {
      key: "Backspace",
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(backspace);
    expect(backspace.defaultPrevented).toBe(true);
    await nextTick();
    expect(mounted.content.value).toBe("open ");
  });

  it("ignores browser caret placeholders before a leading token", async () => {
    const source = "[!skill](tools/skill.md)";
    const mounted = mountComposer({ content: source });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const token = editor.querySelector<HTMLElement>("[data-token-rule=skill]")!;
    const emptyLine = document.createElement("div");
    emptyLine.append(document.createElement("br"));
    editor.insertBefore(emptyLine, token);
    editor.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }),
    );
    await nextTick();

    expect(mounted.content.value).toBe(source);
    expect(editor.firstElementChild?.getAttribute("data-token-rule")).toBe("skill");
  });

  it("pastes clipboard data as plain text", async () => {
    const mounted = mountComposer({ content: "start " });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    setCaret(editor, 6);
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", {
      value: { getData: () => "<b>plain</b>" },
    });
    editor.dispatchEvent(paste);
    await nextTick();

    expect(mounted.content.value).toBe("start <b>plain</b>");
    expect(editor.querySelector("b")).toBeNull();
  });

  it("reflects externally controlled content changes", async () => {
    const mounted = mountComposer({ content: "before" });
    mounted.content.value = "[!skill](tools/skill.md)";
    await nextTick();
    expect(mounted.container.querySelector("[data-token-rule=skill]")).not.toBeNull();
  });

  it("inserts board nodes at the remembered caret and keeps existing content", async () => {
    const mounted = mountComposer({ content: "change this card" });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    setCaret(editor, 7);
    document.dispatchEvent(new Event("selectionchange"));
    const source =
      '<board-node path=".agents/panel/index.html" selector="#status" tag="section" label="Status">Project status</board-node>';

    await mounted.composer.value?.insertContentAndFocus(source);

    expect(mounted.content.value).toBe(`change ${source} this card`);
    const boardToken = editor.querySelector<HTMLElement>("[data-token-rule=board-node]");
    expect(boardToken?.textContent).toContain("Status");
    expect(boardToken?.firstElementChild?.classList.contains("max-w-44")).toBe(true);
    expect(boardToken?.querySelector(".truncate")).not.toBeNull();
    expect(document.activeElement).toBe(editor);
  });

  it("can accumulate multiple board node tokens", async () => {
    const mounted = mountComposer({ content: "Update " });
    const first =
      '<board-node path=".agents/panel/index.html" selector="#one" tag="article" label="One">First</board-node>';
    const second =
      '<board-node path=".agents/panel/index.html" selector="#two" tag="article" label="Two">Second</board-node>';

    await mounted.composer.value?.insertContentAndFocus(first);
    await mounted.composer.value?.insertContentAndFocus(second);

    expect(mounted.content.value).toBe(`Update ${first} ${second} `);
    expect(mounted.container.querySelectorAll("[data-token-rule=board-node]")).toHaveLength(2);
  });

  it("loads a structured template and focuses the first field", async () => {
    const file = { path: "/tmp/context.md", name: "context.md", fileType: "MD" };
    const mounted = mountComposer({ content: "replace me", attachments: [file] });

    await mounted.composer.value?.loadTemplateAndFocus(analysisTemplate);

    const fields = mounted.container.querySelectorAll<HTMLElement>("[data-template-field]");
    const input = fields[0]?.querySelector<HTMLInputElement>("[data-template-control]");
    expect(fields).toHaveLength(2);
    expect(input?.placeholder).toBe("竞品名称/某市场趋势/业务问题");
    expect(document.activeElement).toBe(input);
    expect(mounted.content.value).toBe("帮我撰写一份关于  的分析报告。核心信息包括：。");
    expect(mounted.attachments.value).toEqual([file]);
  });

  it("updates inline input and select values before submitting resolved plain text", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus(analysisTemplate);
    const input = mounted.container.querySelector<HTMLInputElement>(
      '[data-template-field="input"] [data-template-control]',
    )!;
    input.value = "新能源汽车市场";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    await nextTick();

    const select = mounted.container.querySelector<HTMLButtonElement>(
      '[data-template-field="select"] [data-template-control]',
    )!;
    select.click();
    await nextTick();
    document.body
      .querySelector<HTMLElement>('[data-template-option-value="用户反馈与需求"]')!
      .click();
    await nextTick();

    const updatedSelect = mounted.container.querySelector<HTMLButtonElement>(
      '[data-template-field="select"] [data-template-control]',
    )!;
    expect(updatedSelect.textContent).toContain("用户反馈");
    expect(mounted.content.value).toBe(
      "帮我撰写一份关于 新能源汽车市场 的分析报告。核心信息包括：用户反馈与需求。",
    );

    updatedSelect.click();
    await nextTick();
    const selectedOption = document.body.querySelector<HTMLElement>(
      '[data-template-option-value="用户反馈与需求"]',
    )!;
    expect(selectedOption.dataset.state).toBe("checked");
    expect([...selectedOption.classList]).toEqual(expect.arrayContaining(["pr-8", "pl-2"]));
    expect(selectedOption.querySelector("svg")?.classList).toContain("lucide-check-icon");
    updatedSelect.click();
    await nextTick();

    mounted.container.querySelector<HTMLButtonElement>("[data-action=submit]")!.click();
    expect(mounted.submissions).toEqual([
      expect.objectContaining({
        content: "帮我撰写一份关于 新能源汽车市场 的分析报告。核心信息包括：用户反馈与需求。",
      }),
    ]);
    expect(mounted.container.querySelector("[data-template-field]")).toBeNull();
  });

  it("blocks incomplete templates and focuses the first invalid field", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus(analysisTemplate);
    const controls = mounted.container.querySelectorAll<HTMLElement>("[data-template-control]");

    mounted.container.querySelector<HTMLButtonElement>("[data-action=submit]")!.click();

    expect(mounted.submissions).toHaveLength(0);
    expect(document.activeElement).toBe(controls[0]);
    expect(controls[0]?.getAttribute("aria-invalid")).toBe("true");
    expect(controls[1]?.getAttribute("aria-invalid")).toBe("true");
  });

  it("moves between fields with Tab without trapping focus at the boundaries", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus(analysisTemplate);
    const controls = mounted.container.querySelectorAll<HTMLElement>("[data-template-control]");
    const forward = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    controls[0]?.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(controls[1]);

    const boundary = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    controls[1]?.dispatchEvent(boundary);
    expect(boundary.defaultPrevented).toBe(false);

    const backward = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    controls[1]?.dispatchEvent(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(controls[0]);
  });

  it("allows surrounding text edits and atomically deletes an adjacent field", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus({
      segments: [
        { type: "text", content: "before" },
        { type: "input", placeholder: "value" },
        { type: "text", content: "after" },
      ],
    });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const field = editor.querySelector<HTMLElement>("[data-template-field]")!;
    editor.firstChild!.textContent = "edited";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    await nextTick();
    expect(mounted.content.value).toBe("editedafter");

    const range = document.createRange();
    range.setStartAfter(field);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    editor.focus();
    const backspace = new KeyboardEvent("keydown", {
      key: "Backspace",
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(backspace);
    await nextTick();

    expect(backspace.defaultPrevented).toBe(true);
    expect(editor.querySelector("[data-template-field]")).toBeNull();
    expect(mounted.content.value).toBe("editedafter");
  });

  it("keeps template fields beside tokens and exits template mode on plain replacement", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus({
      segments: [
        { type: "text", content: "参考 [work.vue](src/work.vue)：" },
        { type: "input", placeholder: "修改要求" },
      ],
    });
    expect(mounted.container.querySelector("[data-token-rule=vue-file]")).not.toBeNull();
    expect(mounted.container.querySelector("[data-template-field]")).not.toBeNull();

    await mounted.composer.value?.replaceContentAndFocus("普通提示词");
    expect(mounted.container.querySelector("[data-template-field]")).toBeNull();
    expect(mounted.content.value).toBe("普通提示词");
  });

  it("pastes plain text and preserves fields while editing template text", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus({
      segments: [
        { type: "text", content: "主题：" },
        { type: "input", placeholder: "主题" },
        { type: "text", content: "。补充：" },
      ],
    });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const lastText = editor.lastChild!;
    const range = document.createRange();
    range.setStart(lastText, lastText.textContent?.length ?? 0);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [], getData: () => "仅使用公开数据" },
    });

    editor.dispatchEvent(paste);
    await nextTick();

    expect(mounted.content.value).toBe("主题：。补充：仅使用公开数据");
    expect(editor.querySelector("[data-template-field]")).not.toBeNull();
  });

  it("copies resolved text and removes selected fields when cutting across them", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus({
      segments: [
        { type: "text", content: "before" },
        { type: "input", placeholder: "value" },
        { type: "text", content: "after" },
      ],
    });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const input = editor.querySelector<HTMLInputElement>("[data-template-control]")!;
    input.value = "middle";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    await nextTick();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const setData = vi.fn();
    const cut = new Event("cut", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(cut, "clipboardData", { value: { setData } });

    editor.dispatchEvent(cut);
    await nextTick();

    expect(setData).toHaveBeenCalledWith("text/plain", "beforemiddleafter");
    expect(editor.querySelector("[data-template-field]")).toBeNull();
    expect(mounted.content.value).toBe("");
  });

  it("commits inline field text only after IME composition completes", async () => {
    const mounted = mountComposer();
    await mounted.composer.value?.loadTemplateAndFocus({
      segments: [{ type: "input", placeholder: "主题" }],
    });
    const input = mounted.container.querySelector<HTMLInputElement>("[data-template-control]")!;
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.value = "n";
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertCompositionText",
        isComposing: true,
      }),
    );
    await nextTick();
    expect(mounted.content.value).toBe("");

    input.value = "你";
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "你" }));
    await nextTick();
    expect(mounted.content.value).toBe("你");
  });

  it("inserts panel tokens after an empty template field without deleting it", async () => {
    const mounted = mountComposer({ withPanels: true });
    await mounted.composer.value?.loadTemplateAndFocus({
      segments: [
        { type: "input", placeholder: "可选上下文" },
        { type: "text", content: " @wor" },
      ],
    });
    const editor = mounted.container.querySelector<HTMLElement>("[data-slot=prompt-editor]")!;
    const trailingText = editor.lastChild!;
    const range = document.createRange();
    range.setStart(trailingText, trailingText.textContent?.length ?? 0);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();

    mounted.container.querySelector<HTMLButtonElement>("[data-test=mention-panel]")!.click();
    await nextTick();

    expect(editor.querySelector("[data-template-field]")).not.toBeNull();
    expect(editor.querySelector("[data-token-rule=vue-file]")).not.toBeNull();
    expect(mounted.content.value).toBe(" [work.vue](src/work.vue) ");
  });
});
