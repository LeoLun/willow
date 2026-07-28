// @vitest-environment jsdom

import type { ModelConfig } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import {
  defaultComposerTokenRules,
  parseComposerContent,
  PromptComposer,
  serializeFileToken,
  type ComposerModelOption,
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
  const model = ref<ModelConfig>(options.model ?? { providerId: "provider", modelId: "model" });
  const models = ref(options.models ?? []);
  const reasoningEffort = ref<string | undefined>(options.reasoningEffort);
  const streaming = ref(options.streaming ?? false);
  const stopping = ref(options.stopping ?? false);
  const submitting = ref(options.submitting ?? false);
  const submissions: ComposerSubmitPayload[] = [];
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
            content: content.value,
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
    content,
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
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(mounted.panelKeydown).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mention", query: "wor", key: "ArrowDown" }),
    );

    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(mounted.container.querySelector("[data-test=mention-panel]")).toBeNull();
  });

  it("opens an empty mention panel from the plus button", async () => {
    const mounted = mountComposer({ withPanels: true });
    const plus = mounted.container.querySelector<HTMLButtonElement>("[aria-label='添加引用']")!;
    plus.click();
    await nextTick();
    expect(mounted.container.querySelector("[data-test=mention-panel]")?.textContent).toBe("");
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
});
