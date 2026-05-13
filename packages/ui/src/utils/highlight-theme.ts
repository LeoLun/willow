import darkThemeUrl from "highlight.js/styles/atom-one-dark-reasonable.min.css?url";
import lightThemeUrl from "highlight.js/styles/atom-one-light.min.css?url";

const HIGHLIGHT_LINK_ID = "willow-highlight-theme";

let initialized = false;
let observer: MutationObserver | null = null;

function isDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  const body = document.body;
  return root.classList.contains("dark") || body?.classList.contains("dark") || false;
}

function applyThemeStylesheet(): void {
  if (typeof document === "undefined") return;

  const expectedHref = isDarkMode() ? darkThemeUrl : lightThemeUrl;
  let link = document.getElementById(HIGHLIGHT_LINK_ID) as HTMLLinkElement | null;

  if (!link) {
    link = document.createElement("link");
    link.id = HIGHLIGHT_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  if (link.href !== expectedHref) {
    link.href = expectedHref;
  }
}

export function ensureHighlightTheme(): void {
  if (typeof document === "undefined") return;

  applyThemeStylesheet();
  if (initialized) return;
  initialized = true;

  observer = new MutationObserver(() => {
    applyThemeStylesheet();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
}

export function teardownHighlightThemeObserver(): void {
  observer?.disconnect();
  observer = null;
  initialized = false;
}
