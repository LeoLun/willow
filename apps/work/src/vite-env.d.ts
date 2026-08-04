/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "monaco-editor/language/json/monaco.contribution";

interface Window {
  electronAPI: import("./shared").IRenderHook;
}
