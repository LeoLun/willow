// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, type App } from "vue";

const loaderMock = vi.hoisted(() => ({
  loadMonaco: vi.fn(),
}));

const darkModeMock = vi.hoisted(() => ({
  isDark: undefined as { value: boolean } | undefined,
}));

vi.mock("../src/renderer/src/components/right-sidebar/monaco", () => ({
  loadMonaco: loaderMock.loadMonaco,
}));

vi.mock("@/composables/useDarkMode", async () => {
  const { ref: vueRef } = await import("vue");
  darkModeMock.isDark = vueRef(false);
  return { useDarkMode: () => ({ isDark: darkModeMock.isDark }) };
});

import MonacoCodeViewer from "../src/renderer/src/components/right-sidebar/MonacoCodeViewer.vue";

const mountedApps: App[] = [];
let modelValue = "";
let model: {
  dispose: ReturnType<typeof vi.fn>;
  getValue: ReturnType<typeof vi.fn>;
  setValue: ReturnType<typeof vi.fn>;
};
let codeEditor: {
  dispose: ReturnType<typeof vi.fn>;
  getModel: ReturnType<typeof vi.fn>;
  updateOptions: ReturnType<typeof vi.fn>;
};
let monaco: {
  editor: {
    ShowLightbulbIconMode: { Off: string };
    create: ReturnType<typeof vi.fn>;
    setModelLanguage: ReturnType<typeof vi.fn>;
    setTheme: ReturnType<typeof vi.fn>;
  };
};

function mountViewer(
  initial = { ariaLabel: "示例文件", code: "const value = 1;", language: "html" },
) {
  const ariaLabel = ref(initial.ariaLabel);
  const code = ref(initial.code);
  const language = ref(initial.language);
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(MonacoCodeViewer, {
        ariaLabel: ariaLabel.value,
        code: code.value,
        language: language.value,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { app, ariaLabel, code, container, language };
}

async function waitForEditor(): Promise<void> {
  await vi.waitFor(() => expect(monaco.editor.create).toHaveBeenCalledOnce());
  await nextTick();
}

beforeEach(() => {
  modelValue = "const value = 1;";
  model = {
    dispose: vi.fn(),
    getValue: vi.fn(() => modelValue),
    setValue: vi.fn((value: string) => {
      modelValue = value;
    }),
  };
  codeEditor = {
    dispose: vi.fn(),
    getModel: vi.fn(() => model),
    updateOptions: vi.fn(),
  };
  monaco = {
    editor: {
      ShowLightbulbIconMode: { Off: "off" },
      create: vi.fn(() => codeEditor),
      setModelLanguage: vi.fn(),
      setTheme: vi.fn(),
    },
  };
  darkModeMock.isDark!.value = false;
  loaderMock.loadMonaco.mockResolvedValue(monaco);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("MonacoCodeViewer", () => {
  it("creates a compact read-only editor", async () => {
    const { container } = mountViewer();
    await waitForEditor();

    expect(monaco.editor.setTheme).toHaveBeenCalledWith("vs");
    expect(monaco.editor.create).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        ariaLabel: "示例文件",
        automaticLayout: true,
        domReadOnly: true,
        folding: false,
        language: "html",
        minimap: { enabled: false },
        readOnly: true,
        renderValidationDecorations: "off",
        scrollBeyondLastLine: false,
        value: "const value = 1;",
      }),
    );
    expect(container.querySelector('[data-slot="monaco-loading"]')).toBeNull();
  });

  it("updates content, language, label, and theme without recreating the editor", async () => {
    const { ariaLabel, code, language } = mountViewer();
    await waitForEditor();

    code.value = '{"name":"willow"}';
    language.value = "json";
    ariaLabel.value = "package.json 只读代码预览";
    darkModeMock.isDark!.value = true;
    await nextTick();

    expect(model.setValue).toHaveBeenCalledWith('{"name":"willow"}');
    expect(monaco.editor.setModelLanguage).toHaveBeenCalledWith(model, "json");
    expect(codeEditor.updateOptions).toHaveBeenCalledWith({
      ariaLabel: "package.json 只读代码预览",
    });
    expect(monaco.editor.setTheme).toHaveBeenCalledWith("vs-dark");
    expect(monaco.editor.create).toHaveBeenCalledOnce();
  });

  it("disposes the editor and its model when unmounted", async () => {
    const { app } = mountViewer();
    await waitForEditor();

    app.unmount();
    mountedApps.splice(mountedApps.indexOf(app), 1);

    expect(codeEditor.dispose).toHaveBeenCalledOnce();
    expect(model.dispose).toHaveBeenCalledOnce();
  });

  it("does not create an editor if loading finishes after unmount", async () => {
    let resolveMonaco: ((value: typeof monaco) => void) | undefined;
    loaderMock.loadMonaco.mockReturnValue(
      new Promise((resolve) => {
        resolveMonaco = resolve;
      }),
    );
    const { app } = mountViewer();

    app.unmount();
    mountedApps.splice(mountedApps.indexOf(app), 1);
    resolveMonaco?.(monaco);
    await Promise.resolve();
    await nextTick();

    expect(monaco.editor.create).not.toHaveBeenCalled();
  });

  it("renders an error state when Monaco cannot be loaded", async () => {
    loaderMock.loadMonaco.mockRejectedValue(new Error("worker failed"));
    const { container } = mountViewer();

    await vi.waitFor(() => {
      expect(container.querySelector('[data-slot="monaco-error"]')?.textContent).toContain(
        "worker failed",
      );
    });
  });
});
