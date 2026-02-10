import { ref, computed, watch, onMounted } from "vue";

export type ThemeMode = "system" | "light" | "dark";

const themeMode = ref<ThemeMode>("system");
const isDark = ref(false);

let mediaQuery: MediaQueryList | null = null;

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme() {
  const shouldBeDark =
    themeMode.value === "dark" ||
    (themeMode.value === "system" && getSystemDark());

  isDark.value = shouldBeDark;

  if (shouldBeDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function onSystemChange() {
  if (themeMode.value === "system") {
    applyTheme();
  }
}

export function useDarkMode() {
  onMounted(() => {
    const saved = localStorage.getItem("theme") as ThemeMode | null;
    if (saved === "dark" || saved === "light" || saved === "system") {
      themeMode.value = saved;
    }
    applyTheme();

    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", onSystemChange);
  });

  watch(themeMode, () => {
    applyTheme();
    localStorage.setItem("theme", themeMode.value);
  });

  return { themeMode, isDark };
}
