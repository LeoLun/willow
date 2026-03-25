import { resolve } from "path";
import tailwindcss from "@tailwindcss/postcss";
import vue from "@vitejs/plugin-vue";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss() as any, autoprefixer()],
    },
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) =>
            [
              "message-list",
              "user-message",
              "assistant-message",
              "streaming-message-container",
              "tool-message",
              "tool-message-debug",
              "aborted-message",
              "thinking-block",
              "console-block",
              "expandable-section",
              "attachment-tile",
              "artifacts-panel",
              "html-artifact",
              "svg-artifact",
              "markdown-artifact",
              "text-artifact",
              "image-artifact",
              "generic-artifact",
              "docx-artifact",
              "excel-artifact",
              "pdf-artifact",
              "artifact-console",
              "sandbox-iframe",
              "agent-interface",
              "pi-chat-panel",
              "message-editor",
              "provider-key-input",
              "custom-provider-card",
              "theme-toggle",
              "agent-model-selector",
              "session-list-dialog",
              "settings-dialog",
              "api-keys-tab",
              "proxy-tab",
              "api-key-prompt-dialog",
              "attachment-overlay",
              "persistent-storage-dialog",
              "providers-models-tab",
              "custom-provider-dialog",
            ].includes(tag),
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer/src"),
      "@renderer": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
