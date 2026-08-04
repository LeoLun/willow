// oxlint-disable-next-line import/default -- Vite's ?worker transform provides this constructor.
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
// oxlint-disable-next-line import/default -- Vite's ?worker transform provides this constructor.
import JsonWorker from "monaco-editor/language/json/json.worker?worker";

export type Monaco = typeof import("monaco-editor");

let monacoPromise: Promise<Monaco> | undefined;

function configureWorkers(): void {
  globalThis.MonacoEnvironment = {
    ...globalThis.MonacoEnvironment,
    getWorker(_workerId, label) {
      if (label === "json") return new JsonWorker();
      return new EditorWorker();
    },
  };
}

export function loadMonaco(): Promise<Monaco> {
  if (!monacoPromise) {
    configureWorkers();
    monacoPromise = Promise.all([
      import("monaco-editor"),
      import("monaco-editor/languages/definitions/html/register"),
      import("monaco-editor/languages/definitions/markdown/register"),
      import("monaco-editor/language/json/monaco.contribution"),
    ]).then(([monaco]) => monaco);
  }

  return monacoPromise;
}
