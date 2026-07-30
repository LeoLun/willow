import type { ThemeMode } from "@shared/api";
import { onMounted, ref, watch } from "vue";
import { electronAPI } from "@/lib/ipc";

const themeMode = ref<ThemeMode>("system");
const isDark = ref(false);

let mediaQuery: MediaQueryList | null = null;
let initialized = false;

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme() {
  const shouldBeDark =
    themeMode.value === "dark" || (themeMode.value === "system" && getSystemDark());

  isDark.value = shouldBeDark;

  if (shouldBeDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function syncNativeTheme() {
  void electronAPI.setTheme({ mode: themeMode.value }).catch((error: unknown) => {
    console.error("Failed to sync native theme", error);
  });
}

function onSystemChange() {
  if (themeMode.value === "system") {
    applyTheme();
  }
}

export function useDarkMode() {
  onMounted(() => {
    if (initialized) return;
    initialized = true;

    const saved = localStorage.getItem("theme") as ThemeMode | null;
    if (saved === "dark" || saved === "light" || saved === "system") {
      themeMode.value = saved;
    }
    applyTheme();
    syncNativeTheme();

    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", onSystemChange);

    watch(themeMode, () => {
      applyTheme();
      syncNativeTheme();
      localStorage.setItem("theme", themeMode.value);
    });
  });

  return { themeMode, isDark };
}
