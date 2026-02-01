/// <reference types="vite/client" />
import { IRenderHook } from "./shared";

declare global {
  interface Window {
    electronAPI: IRenderHook;
  }
}
